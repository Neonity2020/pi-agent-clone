// ============================================================================
// Interactive List Picker — ↑↓ navigate, Enter select, Ctrl+C cancel
//
// Uses process.stdin raw mode to capture individual keypresses.
// Renders an in-terminal list with highlighted selection cursor.
//
// Usage:
//   const result = await pick(items, { title: "Select:" }, rl);
//   // result: PickerItem | null (null = cancelled)
// ============================================================================

import type { Interface as ReadlineInterface } from "readline";
import { chalk } from "../markdown.js";

export interface PickerItem {
  label: string;        // Primary display text
  value: string;        // Selection value
  detail?: string;      // Secondary info (dimmed)
  badge?: string;       // Right-side label (e.g. "◀ current", "✓")
}

export interface PickerOptions {
  title: string;
  footer?: string;
}

// ---- Chalk shortcuts -------------------------------------------------------

const C = {
  reset:      chalk.reset,
  bold:       chalk.bold,
  dim:        chalk.dim,
  green:      chalk.green,
  cyan:       chalk.cyan,
  yellow:     chalk.yellow,
  red:        chalk.red,
  hideCursor: "\x1b[?25l",
  showCursor: "\x1b[?25h",
  clearBelow: "\x1b[J",
  moveUp:     (n: number) => `\x1b[${n}A`,
};

// ---- Key codes (raw mode) --------------------------------------------------

const KEY_UP    = "\x1b[A";
const KEY_DOWN  = "\x1b[B";
const KEY_ENTER = "\r";
const KEY_CTRLC = "\x03";
const KEY_ESC   = "\x1b";

// ---- Render ----------------------------------------------------------------

function renderFrame(
  items: PickerItem[],
  selected: number,
  title: string,
  footer: string,
): string {
  const lines: string[] = ["", `  ${C.bold.cyan(title)}`, ""];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const active = i === selected;

    if (active) {
      const cursor = C.bold.green("❯");
      const label = C.bold.cyan(item.label);
      let line = `    ${cursor} ${label}`;
      if (item.detail) line += `  ${C.dim(item.detail)}`;
      if (item.badge)  line += `  ${C.yellow(item.badge)}`;
      lines.push(line);
    } else {
      let line = `      ${item.label}`;
      if (item.detail) line += `  ${C.dim(item.detail)}`;
      if (item.badge)  line += `  ${C.dim(item.badge)}`;
      lines.push(line);
    }
  }

  lines.push("");
  lines.push(`  ${C.dim(footer)}`);

  return lines.join("\n");
}

// ---- Main picker -----------------------------------------------------------

/**
 * Show an interactive list picker in the terminal.
 *
 * - ↑/↓ or j/k: navigate
 * - Enter:       select
 * - Ctrl+C/Esc:  cancel
 */
export async function pick(
  items: PickerItem[],
  options: PickerOptions,
  rl?: ReadlineInterface,
): Promise<PickerItem | null> {
  // Edge case: empty list
  if (items.length === 0) {
    console.log(`  ${C.dim("(no items)")}`);
    return null;
  }

  // Non-TTY fallback: can't do interactive, show numbered list
  if (!process.stdin.isTTY) {
    console.log(`  ${options.title}`);
    items.forEach((item, i) => {
      console.log(`    ${i + 1}. ${item.label}${item.detail ? `  ${item.detail}` : ""}`);
    });
    console.log(`  ${C.dim("(non-interactive mode, selecting first item)")}`);
    return items[0];
  }

  const footer = options.footer || "↑↓ navigate · Enter select · Ctrl+C cancel";
  let selected = 0;

  // Pause readline to prevent interference with raw mode
  rl?.pause();

  // Render initial frame
  process.stdout.write(C.hideCursor);
  const frame = renderFrame(items, selected, options.title, footer);
  const lineCount = frame.split("\n").length;
  process.stdout.write(frame + "\n");

  try {
    const result = await new Promise<PickerItem | null>((resolve) => {
      const savedRaw = process.stdin.isRaw;

      const cleanup = (value: PickerItem | null) => {
        // Restore terminal state
        process.stdin.setRawMode(savedRaw ?? false);
        process.stdout.write(C.showCursor);

        // Clear picker frame from screen
        process.stdout.write(C.moveUp(lineCount));
        process.stdout.write(C.clearBelow);

        process.stdin.removeListener("data", onKey);
        resolve(value);
      };

      const onKey = (data: Buffer) => {
        const key = data.toString();

        switch (key) {
          case KEY_UP:
          case "k":
            selected = (selected - 1 + items.length) % items.length;
            break;

          case KEY_DOWN:
          case "j":
            selected = (selected + 1) % items.length;
            break;

          case KEY_ENTER:
          case "\n":
            cleanup(items[selected]);
            return;

          case KEY_CTRLC:
          case KEY_ESC:
            cleanup(null);
            return;

          default:
            return;
        }

        // Redraw frame
        process.stdout.write(C.moveUp(lineCount));
        process.stdout.write(
          renderFrame(items, selected, options.title, footer) + "\n",
        );
      };

      // Enter raw mode
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on("data", onKey);
    });

    return result;
  } finally {
    // Always resume readline
    rl?.resume();
  }
}

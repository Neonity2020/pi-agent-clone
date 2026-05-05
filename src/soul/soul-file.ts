// ============================================================================
// SOUL.md - Agent's Personality and Identity
//
// Design:
//   - Single file: ~/.neonity-agent/SOUL.md
//   - Format: §-delimited entries (same as MEMORY.md for consistency)
//   - Each entry defines the agent's personality traits, behavior guidelines,
//     communication style, or identity elements
//   - Entries separated by "§" on its own line
//   - Loaded into system prompt at session start and after each write
//   - Agent can read/write/search via soul_* tools
//
// Example SOUL.md:
//   I am an optimistic and helpful AI assistant.
//   §
//   I speak in a friendly, casual tone with users.
//   §
//   I prefer to provide code examples with explanations.
//   §
//   I admit when I don't know something rather than making up answers.
// ============================================================================

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

const DEFAULT_SOUL_DIR = () =>
  path.join(os.homedir(), ".neonity-agent");
const SOUL_FILENAME = "SOUL.md";
const SEPARATOR = "§";

/** Get the path to the SOUL.md file */
export function getSoulPath(dir?: string): string {
  return path.join(dir ?? DEFAULT_SOUL_DIR(), SOUL_FILENAME);
}

/** Read all soul entries, returns array of trimmed strings */
export async function readSoul(dir?: string): Promise<string[]> {
  const soulPath = getSoulPath(dir);
  try {
    const content = await fs.readFile(soulPath, "utf-8");
    return content
      .split(SEPARATOR)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } catch {
    return [];
  }
}

/** Write the full SOUL.md from an array of entries */
export async function writeSoul(entries: string[], dir?: string): Promise<void> {
  const soulPath = getSoulPath(dir);
  const soulDir = path.dirname(soulPath);
  await fs.mkdir(soulDir, { recursive: true });
  const content = entries.join("\n§\n") + "\n";
  await fs.writeFile(soulPath, content, "utf-8");
}

/** Add a single entry to SOUL.md (append) */
export async function addSoul(entry: string, dir?: string): Promise<number> {
  const entries = await readSoul(dir);
  const trimmed = entry.trim();
  if (!trimmed) return entries.length;

  // Deduplication: exact match check
  if (entries.includes(trimmed)) return entries.length;

  entries.push(trimmed);
  await writeSoul(entries, dir);
  return entries.length;
}

/** Remove entries that contain the given text (fuzzy match) */
export async function removeSoul(query: string, dir?: string): Promise<number> {
  const entries = await readSoul(dir);
  const lowerQuery = query.toLowerCase();
  const filtered = entries.filter((e) => !e.toLowerCase().includes(lowerQuery));
  await writeSoul(filtered, dir);
  return entries.length - filtered.length;
}

/** Replace an entry containing oldText with newText */
export async function replaceSoul(
  oldText: string,
  newText: string,
  dir?: string,
): Promise<boolean> {
  const entries = await readSoul(dir);
  const lowerOld = oldText.toLowerCase();
  let found = false;

  const updated = entries.map((e) => {
    if (e.toLowerCase().includes(lowerOld)) {
      found = true;
      return newText.trim();
    }
    return e;
  });

  if (found) {
    await writeSoul(updated, dir);
  }
  return found;
}

/** Search soul entries by keyword */
export async function searchSoul(query: string, dir?: string): Promise<string[]> {
  const entries = await readSoul(dir);
  const lowerQuery = query.toLowerCase();
  return entries.filter((e) => e.toLowerCase().includes(lowerQuery));
}

/** Format all soul entries as a single string for system prompt injection */
export async function formatSoulForPrompt(dir?: string): Promise<string> {
  const entries = await readSoul(dir);
  if (entries.length === 0) return "";
  return entries.join("\n");
}

/** Get soul stats for display */
export async function getSoulStats(dir?: string): Promise<{
  path: string;
  entries: number;
  sizeBytes: number;
}> {
  const soulPath = getSoulPath(dir);
  const entries = await readSoul(dir);
  let sizeBytes = 0;
  try {
    const stat = await fs.stat(soulPath);
    sizeBytes = stat.size;
  } catch {
    // file doesn't exist yet
  }
  return { path: soulPath, entries: entries.length, sizeBytes };
}

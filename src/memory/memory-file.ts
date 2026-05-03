// ============================================================================
// MEMORY.md Long-Term Memory Provider
//
// Design:
//   - Single file: ~/.pi-agent/MEMORY.md
//   - Format: §-delimited entries (same as Hermes Agent's FileMemoryProvider)
//   - Each entry is a declarative fact, one per paragraph
//   - Entries separated by "§" on its own line
//   - Loaded into system prompt at session start and after each write
//   - Agent can read/write/search via memory_* tools
//
// Example MEMORY.md:
//   User prefers Chinese language responses.
//   §
//   Project uses pnpm, not npm.
//   §
//   API key for GLM is stored in .env file.
// ============================================================================

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

const DEFAULT_MEMORY_DIR = () =>
  path.join(os.homedir(), ".pi-agent");
const MEMORY_FILENAME = "MEMORY.md";
const SEPARATOR = "§";

/** Get the path to the MEMORY.md file */
export function getMemoryPath(dir?: string): string {
  return path.join(dir ?? DEFAULT_MEMORY_DIR(), MEMORY_FILENAME);
}

/** Read all memory entries, returns array of trimmed strings */
export async function readMemory(dir?: string): Promise<string[]> {
  const memoryPath = getMemoryPath(dir);
  try {
    const content = await fs.readFile(memoryPath, "utf-8");
    return content
      .split(SEPARATOR)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } catch {
    return [];
  }
}

/** Write the full MEMORY.md from an array of entries */
export async function writeMemory(entries: string[], dir?: string): Promise<void> {
  const memoryPath = getMemoryPath(dir);
  const memoryDir = path.dirname(memoryPath);
  await fs.mkdir(memoryDir, { recursive: true });
  const content = entries.join("\n§\n") + "\n";
  await fs.writeFile(memoryPath, content, "utf-8");
}

/** Add a single entry to MEMORY.md (append) */
export async function addMemory(entry: string, dir?: string): Promise<number> {
  const entries = await readMemory(dir);
  const trimmed = entry.trim();
  if (!trimmed) return entries.length;

  // Deduplication: exact match check
  if (entries.includes(trimmed)) return entries.length;

  entries.push(trimmed);
  await writeMemory(entries, dir);
  return entries.length;
}

/** Remove entries that contain the given text (fuzzy match) */
export async function removeMemory(query: string, dir?: string): Promise<number> {
  const entries = await readMemory(dir);
  const lowerQuery = query.toLowerCase();
  const filtered = entries.filter((e) => !e.toLowerCase().includes(lowerQuery));
  await writeMemory(filtered, dir);
  return entries.length - filtered.length;
}

/** Replace an entry containing oldText with newText */
export async function replaceMemory(
  oldText: string,
  newText: string,
  dir?: string,
): Promise<boolean> {
  const entries = await readMemory(dir);
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
    await writeMemory(updated, dir);
  }
  return found;
}

/** Search memory entries by keyword */
export async function searchMemory(query: string, dir?: string): Promise<string[]> {
  const entries = await readMemory(dir);
  const lowerQuery = query.toLowerCase();
  return entries.filter((e) => e.toLowerCase().includes(lowerQuery));
}

/** Format all memory entries as a single string for system prompt injection */
export async function formatMemoryForPrompt(dir?: string): Promise<string> {
  const entries = await readMemory(dir);
  if (entries.length === 0) return "";
  return entries.join("\n");
}

/** Get memory stats for display */
export async function getMemoryStats(dir?: string): Promise<{
  path: string;
  entries: number;
  sizeBytes: number;
}> {
  const memoryPath = getMemoryPath(dir);
  const entries = await readMemory(dir);
  let sizeBytes = 0;
  try {
    const stat = await fs.stat(memoryPath);
    sizeBytes = stat.size;
  } catch {
    // file doesn't exist yet
  }
  return { path: memoryPath, entries: entries.length, sizeBytes };
}

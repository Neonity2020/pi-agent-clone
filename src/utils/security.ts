// ============================================================================
// Security Utilities — path sandboxing, command validation, input validation
// ============================================================================

import * as path from "path";
import * as fs from "fs/promises";

// ---- Configurable sandbox root (defaults to cwd) -------------------------

let sandboxRoot: string = process.cwd();

/**
 * Set the sandbox root directory. All file operations will be restricted
 * to this directory and its subdirectories.
 */
export function setSandboxRoot(root: string): void {
  sandboxRoot = path.resolve(root);
}

/**
 * Get the current sandbox root.
 */
export function getSandboxRoot(): string {
  return sandboxRoot;
}

// ---- Path sandboxing -----------------------------------------------------

/**
 * Validate and resolve a file path within the sandbox.
 * Prevents path traversal attacks (e.g. "../../etc/passwd").
 *
 * @returns The resolved absolute path if it's within the sandbox.
 * @throws Error if the path escapes the sandbox.
 */
export function resolveSandboxedPath(filePath: string): string {
  const resolved = path.resolve(filePath);
  const normalizedRoot = path.normalize(sandboxRoot);

  // Check if the resolved path is within the sandbox root
  if (!resolved.startsWith(normalizedRoot + path.sep) && resolved !== normalizedRoot) {
    throw new Error(
      `Security: path "${filePath}" resolves to "${resolved}", ` +
      `which is outside the sandbox ("${normalizedRoot}"). Access denied.`
    );
  }

  return resolved;
}

/**
 * Check if a resolved path is within the sandbox (non-throwing version).
 */
export function isWithinSandbox(filePath: string): boolean {
  try {
    resolveSandboxedPath(filePath);
    return true;
  } catch {
    return false;
  }
}

// ---- Sensitive path protection -------------------------------------------

const SENSITIVE_PATTERNS: RegExp[] = [
  /\/\.ssh\//i,
  /\/\.gnupg\//i,
  /\/\.aws\//i,
  /\.pem$/i,
  /\.key$/i,
  /\/id_rsa/i,
  /\/id_ed25519/i,
  /\/id_ecdsa/i,
  /\.env(\.|$)/i,           // .env, .env.local, .env.production
  /\/etc\/passwd/i,
  /\/etc\/shadow/i,
  /\/etc\/ssh\//i,
];

/**
 * Check if a path points to a sensitive file (SSH keys, env files, etc.).
 * Returns a warning message if sensitive, or null if safe.
 */
export function checkSensitivePath(filePath: string): string | null {
  const resolved = path.resolve(filePath);
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(resolved)) {
      return `Warning: path "${resolved}" appears to be a sensitive file. Proceed with caution.`;
    }
  }
  return null;
}

// ---- Command validation --------------------------------------------------

/**
 * Patterns for dangerous shell commands that should be blocked or warned about.
 * These are commands that can cause irreversible system damage.
 */
const BLOCKED_COMMAND_PATTERNS: RegExp[] = [
  /\brm\s+(-\w*r\w*f\w*|--recursive).*\s+\//i,   // rm -rf / (destructive recursive delete on root)
  /\brm\s+(-\w*f\w*r\w*|--force).*\s+\//i,       // rm -fr / (variant)
  /\bdd\s+.*of=\/dev\//i,                          // dd to device (disk wipe)
  /\bmkfs\./i,                                      // format filesystem
  />\s*\/dev\/sda/i,                                // overwrite disk
  /\bchmod\s+(-\w*\s+)?0?777\s+\//i,               // chmod 777 on root
  /\bchown\s+.*\s+\//i,                             // chown on root
];

/**
 * Patterns for commands that are risky but may be legitimate.
 * These should trigger a warning but not be blocked.
 */
const WARN_COMMAND_PATTERNS: RegExp[] = [
  /\brm\s+(-\w*r\w*f\w*|--recursive)/i,            // rm -rf (any target)
  /\bgit\s+push\s+.*--force/i,                      // force push
  /\bgit\s+reset\s+--hard/i,                        // hard reset
  /\bdrop\s+(database|table)/i,                     // SQL drops
  /\btruncate\s+table/i,                             // SQL truncate
  /\bsudo\s+/i,                                      // sudo commands
  /\bsu\s+/i,                                        // switch user
  /\bcurl\s+.*\|\s*sh/i,                            // curl | sh (pipe to shell)
  /\bwget\s+.*\|\s*sh/i,                            // wget | sh
];

export interface CommandValidationResult {
  allowed: boolean;
  warning?: string;
  reason?: string;
}

/**
 * Validate a shell command for dangerous patterns.
 * Returns whether the command is allowed, and any warnings.
 */
export function validateCommand(command: string): CommandValidationResult {
  // Check blocked patterns first
  for (const pattern of BLOCKED_COMMAND_PATTERNS) {
    if (pattern.test(command)) {
      return {
        allowed: false,
        reason: `Blocked: command matches dangerous pattern. For safety, this command is not permitted.`,
      };
    }
  }

  // Check warning patterns
  for (const pattern of WARN_COMMAND_PATTERNS) {
    if (pattern.test(command)) {
      return {
        allowed: true,
        warning: `⚠ Potentially dangerous command detected. Proceed with caution.`,
      };
    }
  }

  return { allowed: true };
}

// ---- Input validation ----------------------------------------------------

/**
 * Validate and sanitize a string argument from tool input.
 * Ensures the value is a non-empty string.
 */
export function validateStringArg(value: unknown, name: string): string {
  if (value === undefined || value === null) {
    throw new Error(`Validation error: "${name}" is required.`);
  }
  if (typeof value !== "string") {
    throw new Error(`Validation error: "${name}" must be a string, got ${typeof value}.`);
  }
  if (value.length === 0) {
    throw new Error(`Validation error: "${name}" must not be empty.`);
  }
  return value;
}

/**
 * Validate a numeric argument from tool input.
 */
export function validateNumberArg(
  value: unknown,
  name: string,
  min?: number,
  max?: number,
): number {
  if (value === undefined || value === null) {
    throw new Error(`Validation error: "${name}" is required.`);
  }
  const num = Number(value);
  if (isNaN(num)) {
    throw new Error(`Validation error: "${name}" must be a number, got "${value}".`);
  }
  if (min !== undefined && num < min) {
    throw new Error(`Validation error: "${name}" must be >= ${min}, got ${num}.`);
  }
  if (max !== undefined && num > max) {
    throw new Error(`Validation error: "${name}" must be <= ${max}, got ${num}.`);
  }
  return num;
}

// ---- File size limits ----------------------------------------------------

const MAX_WRITE_SIZE = 10 * 1024 * 1024; // 10MB max write

/**
 * Check if content size is within safe limits.
 */
export function validateWriteSize(content: string): void {
  const bytes = Buffer.byteLength(content, "utf-8");
  if (bytes > MAX_WRITE_SIZE) {
    throw new Error(
      `Security: content size (${bytes} bytes) exceeds maximum allowed size (${MAX_WRITE_SIZE} bytes).`
    );
  }
}

// ============================================================================
// Built-in tool: ls — list directory contents
// ============================================================================

import type { ToolHandler } from "../types.js";
import { readdir, stat } from "fs/promises";
import { join, relative, extname, basename } from "path";

interface FileInfo {
  name: string;
  path: string;
  type: "file" | "directory" | "symlink";
  size?: number;
  extension?: string;
  modified?: Date;
}

interface DirectoryInfo {
  path: string;
  files: FileInfo[];
  directories: string[];
  totalFiles: number;
  totalSize: number;
}

export const lsTool: ToolHandler = {
  definition: {
    name: "ls",
    description: "List directory contents with detailed information. Shows files, directories, and their metadata. Supports recursive listing, filtering by extension, and structured output for easy parsing.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Directory path to list (defaults to current directory)",
        },
        recursive: {
          type: "boolean",
          description: "List contents recursively (default: false)",
        },
        maxDepth: {
          type: "number",
          description: "Maximum depth for recursive listing (default: 3, -1 for unlimited)",
        },
        includeHidden: {
          type: "boolean",
          description: "Include hidden files/directories starting with . (default: false)",
        },
        extensions: {
          type: "array",
          items: { type: "string" },
          description: "Filter files by extension (e.g., [\".ts\", \".js\"])",
        },
        format: {
          type: "string",
          enum: ["tree", "json", "table"],
          description: "Output format: tree (ASCII tree), json (structured), or table (default: tree)",
        },
      },
    },
  },

  async execute(args: Record<string, unknown>): Promise<string> {
    const path = (args.path as string) || ".";
    const recursive = (args.recursive as boolean) || false;
    let maxDepth = (args.maxDepth as number) || 3;
    const includeHidden = (args.includeHidden as boolean) || false;
    const extensions = args.extensions as string[] | undefined;
    const format = (args.format as "tree" | "json" | "table") || "tree";

    if (maxDepth === -1) maxDepth = Infinity;

    try {
      const dirInfo = await scanDirectory(
        path,
        recursive,
        maxDepth,
        includeHidden,
        extensions,
      );

      switch (format) {
        case "json":
          return formatAsJson(dirInfo);
        case "table":
          return formatAsTable(dirInfo);
        case "tree":
        default:
          return formatAsTree(dirInfo, path);
      }
    } catch (err: any) {
      return `Error listing directory: ${err.message}`;
    }
  },
};

/**
 * Scan a directory recursively
 */
async function scanDirectory(
  dirPath: string,
  recursive: boolean,
  maxDepth: number,
  includeHidden: boolean,
  extensions?: string[],
): Promise<DirectoryInfo> {
  const files: FileInfo[] = [];
  const directories: string[] = [];
  let totalSize = 0;

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // Skip hidden files/directories
      if (!includeHidden && entry.name.startsWith(".")) {
        continue;
      }

      // Skip node_modules and .git by default
      if (entry.name === "node_modules" || entry.name === ".git") {
        continue;
      }

      const fullPath = join(dirPath, entry.name);
      const relativePath = relative(process.cwd(), fullPath);

      let type: "file" | "directory" | "symlink" = "file";
      let size: number | undefined;
      let modified: Date | undefined;

      try {
        const stats = await stat(fullPath);
        type = stats.isDirectory() ? "directory" : stats.isSymbolicLink() ? "symlink" : "file";
        size = stats.size;
        modified = stats.mtime;
      } catch {
        // Skip if can't stat
        continue;
      }

      if (type === "directory") {
        directories.push(entry.name);
      }

      // Filter by extension
      const ext = extname(entry.name).toLowerCase();
      if (extensions && !extensions.includes(ext) && type === "file") {
        continue;
      }

      const fileInfo: FileInfo = {
        name: entry.name,
        path: relativePath || ".",
        type,
        size,
        extension: type === "file" ? ext || "(none)" : undefined,
        modified,
      };

      files.push(fileInfo);
      if (size) totalSize += size;

      // Recursive scan
      if (recursive && type === "directory" && maxDepth > 0) {
        try {
          const subDirInfo = await scanDirectory(
            fullPath,
            true,
            maxDepth - 1,
            includeHidden,
            extensions,
          );
          files.push(...subDirInfo.files);
          directories.push(...subDirInfo.directories);
          totalSize += subDirInfo.totalSize;
        } catch {
          // Skip directories we can't read
        }
      }
    }
  } catch (err: any) {
    if (err.code === "ENOTDIR") {
      // It's a file, not a directory
      const stats = await stat(dirPath);
      return {
        path: relative(process.cwd(), dirPath),
        files: [
          {
            name: basename(dirPath),
            path: relative(process.cwd(), dirPath),
            type: "file",
            size: stats.size,
            extension: extname(dirPath) || "(none)",
            modified: stats.mtime,
          },
        ],
        directories: [],
        totalFiles: 1,
        totalSize: stats.size,
      };
    }
    throw err;
  }

  return {
    path: relative(process.cwd(), dirPath) || ".",
    files,
    directories,
    totalFiles: files.length,
    totalSize,
  };
}

/**
 * Format as JSON
 */
function formatAsJson(dirInfo: DirectoryInfo): string {
  const output = {
    path: dirInfo.path,
    summary: {
      totalFiles: dirInfo.totalFiles,
      directories: dirInfo.directories.length,
      totalSize: formatBytes(dirInfo.totalSize),
    },
    directories: dirInfo.directories,
    files: dirInfo.files.map((f) => ({
      ...f,
      size: f.size ? formatBytes(f.size) : undefined,
      modified: f.modified?.toISOString(),
    })),
  };

  return JSON.stringify(output, null, 2);
}

/**
 * Format as table
 */
function formatAsTable(dirInfo: DirectoryInfo): string {
  let output = `Directory: ${dirInfo.path}\n`;
  output += "=".repeat(80) + "\n\n";

  // Summary
  output += `Summary:\n`;
  output += `  Files: ${dirInfo.totalFiles}\n`;
  output += `  Directories: ${dirInfo.directories.length}\n`;
  output += `  Total Size: ${formatBytes(dirInfo.totalSize)}\n\n`;

  // Directories
  if (dirInfo.directories.length > 0) {
    output += "Directories:\n";
    output += dirInfo.directories.map((d) => `  📁 ${d}/`).join("\n") + "\n\n";
  }

  // Files
  if (dirInfo.files.length > 0) {
    output += "Files:\n";

    // Build table rows
    const rows = dirInfo.files.map((f) => {
      const icon = f.type === "directory" ? "📁" : f.type === "symlink" ? "🔗" : "📄";
      const size = f.size ? formatBytes(f.size) : "";
      const modified = f.modified ? formatDate(f.modified) : "";
      return `${icon} ${f.name.padEnd(40)} ${size.padEnd(10)} ${modified}`;
    });

    // Header
    output += `  ${"Name".padEnd(42)} ${"Size".padEnd(10)} Modified\n`;
    output += "  " + "-".repeat(70) + "\n";

    // Rows
    output += rows.map((r) => "  " + r).join("\n") + "\n";
  }

  return output;
}

/**
 * Format as ASCII tree
 */
function formatAsTree(dirInfo: DirectoryInfo, basePath: string): string {
  let output = `📂 ${dirInfo.path}/\n`;
  output += `${formatBytes(dirInfo.totalSize)}, ${dirInfo.totalFiles} files, ${dirInfo.directories.length} directories\n`;
  output += "=".repeat(60) + "\n\n";

  // Group files by directory
  const byDir = new Map<string, FileInfo[]>();
  for (const file of dirInfo.files) {
    const dir = file.path.split("/").slice(0, -1).join("/") || ".";
    if (!byDir.has(dir)) {
      byDir.set(dir, []);
    }
    byDir.get(dir)!.push(file);
  }

  // Get sorted list of directories
  const dirs = Array.from(byDir.keys()).sort();

  for (const dir of dirs) {
    const files = byDir.get(dir)!;
    const relativeDir = dir === "." ? "" : dir + "/";

    if (relativeDir) {
      output += `\n📁 ${relativeDir}\n`;
    }

    for (const file of files) {
      const indent = relativeDir ? "  " : "";
      const icon = file.type === "directory" ? "📁" : file.type === "symlink" ? "🔗" : "📄";
      const size = file.size ? ` (${formatBytes(file.size)})` : "";
      output += `${indent}${icon} ${file.name}${size}\n`;
    }
  }

  return output;
}

/**
 * Format bytes to human-readable
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return "today";
  } else if (days === 1) {
    return "yesterday";
  } else if (days < 7) {
    return `${days} days ago`;
  } else if (days < 30) {
    return `${Math.floor(days / 7)} weeks ago`;
  } else {
    return date.toLocaleDateString();
  }
}

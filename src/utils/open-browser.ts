// ============================================================================
// Utility: Open URL in default browser
// ============================================================================

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Open a URL in the system's default browser.
 * Cross-platform: works on macOS, Linux, and Windows.
 */
export async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;

  let command: string;
  switch (platform) {
    case "darwin": // macOS
      command = `open "${url}"`;
      break;
    case "linux":
      command = `xdg-open "${url}"`;
      break;
    case "win32":
      command = `start "" "${url}"`;
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  try {
    await execAsync(command);
  } catch (err) {
    throw new Error(`Failed to open browser: ${err}`);
  }
}

/**
 * Alternative: Using the 'open' npm package (recommended for production)
 *
 * Install: npm install open
 *
 * import open from 'open';
 * await open(url);
 */

/**
 * Example usage:
 *
 * // Open GitHub repository
 * await openBrowser('https://github.com/Neonity2020/pi-agent-clone');
 *
 * // Open a file
 * await openBrowser('file:///Users/andi/Documents/file.pdf');
 *
 * // Open with specific browser
 * await openBrowser('https://example.com', 'chrome');
 */

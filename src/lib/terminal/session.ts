/**
 * Shared interactive-terminal session logic.
 *
 * Attaches the local TTY to a sandbox's terminal over a WebSocket: forwards
 * stdin, streams output, handles resize, and cleans up on exit. Used by both
 * the `terminal` command (connect to an existing sandbox) and the `shell`
 * command (create + connect in one step).
 */

import chalk from "chalk";
import type { Sandbox } from "@hopx-ai/sdk";

export interface TerminalSessionOptions {
  /**
   * Invoked exactly once when the session ends, before the process exits.
   * Use it for teardown such as killing an ephemeral sandbox. Errors are
   * caught and reported so the process still exits cleanly.
   */
  onExit?: () => void | Promise<void>;
}

/**
 * Attach an interactive terminal to a live sandbox. Resolves only when the
 * session ends — at which point it also terminates the process.
 */
export async function attachInteractiveTerminal(
  sandbox: Sandbox,
  options: TerminalSessionOptions = {}
): Promise<void> {
  const terminal = sandbox.terminal;
  const ws = await terminal.connect();

  let cleanedUp = false;
  const cleanup = async () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
    ws.close();
    try {
      await options.onExit?.();
    } catch (err) {
      console.error(
        chalk.red(`Cleanup error: ${err instanceof Error ? err.message : String(err)}`)
      );
    }
    process.exit(0);
  };

  // Stream output from the sandbox to the local terminal.
  ws.on("message", (data: Buffer | string) => {
    try {
      const message = typeof data === "string" ? data : data.toString("utf-8");
      if (!message || !message.trim()) return;

      const parsed = JSON.parse(message);
      if (parsed.type === "output" && parsed.data) {
        process.stdout.write(parsed.data);
      } else if (parsed.type === "exit") {
        console.log(chalk.gray(`\nSession ended (exit code: ${parsed.exitCode ?? 0})`));
        void cleanup();
      }
    } catch {
      // Non-JSON data, write directly.
      process.stdout.write(data.toString());
    }
  });

  ws.on("close", () => void cleanup());
  ws.on("error", () => void cleanup());

  // Forward local input to the sandbox in raw mode.
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  const cols = process.stdout.columns ?? 80;
  const rows = process.stdout.rows ?? 24;
  terminal.resize(ws, cols, rows);

  process.stdin.on("data", (data: Buffer) => {
    terminal.sendInput(ws, data.toString());
  });

  process.stdout.on("resize", () => {
    const newCols = process.stdout.columns ?? 80;
    const newRows = process.stdout.rows ?? 24;
    terminal.resize(ws, newCols, newRows);
  });

  process.on("SIGINT", () => void cleanup());
  process.on("SIGTERM", () => void cleanup());

  // Keep the process alive until the session ends.
  await new Promise<void>(() => {});
}

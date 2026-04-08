/**
 * terminal command - Interactive terminal sessions
 */

import { Command } from "commander";
import chalk from "chalk";
import { Sandbox } from "@hopx-ai/sdk";
import { requireApiKey } from "../lib/auth/token.js";
import { getBaseUrl } from "../lib/config.js";
import { withErrorHandler } from "../lib/errors.js";
import { info } from "../lib/output/progress.js";

export const terminalCommand = new Command("terminal")
  .alias("term")
  .description("Interactive terminal session")
  .argument("<sandbox-id>", "Sandbox ID")
  .action(
    withErrorHandler(async (sandboxId: string) => {
      const apiKey = await requireApiKey();

      info(`Connecting to sandbox: ${sandboxId}`);
      console.log(chalk.gray("Press Ctrl+C to exit\n"));

      const sandbox = await Sandbox.connect(sandboxId, apiKey, getBaseUrl());
      const terminal = sandbox.terminal;

      // Connect to terminal WebSocket
      const ws = await terminal.connect();

      // Cleanup function
      let cleanedUp = false;
      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        process.stdin.pause();
        ws.close();
        process.exit(0);
      };

      // Handle WebSocket messages directly
      ws.on("message", (data: Buffer | string) => {
        try {
          const message = typeof data === "string" ? data : data.toString("utf-8");
          if (!message || !message.trim()) return;

          const parsed = JSON.parse(message);
          if (parsed.type === "output" && parsed.data) {
            process.stdout.write(parsed.data);
          } else if (parsed.type === "exit") {
            console.log(chalk.gray(`\nSession ended (exit code: ${parsed.exitCode ?? 0})`));
            cleanup();
          }
        } catch {
          // Non-JSON data, write directly
          process.stdout.write(data.toString());
        }
      });

      ws.on("close", cleanup);
      ws.on("error", cleanup);

      // Set up raw mode for stdin
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();

      // Get initial terminal size and send resize
      const cols = process.stdout.columns ?? 80;
      const rows = process.stdout.rows ?? 24;
      terminal.resize(ws, cols, rows);

      // Forward stdin to terminal
      process.stdin.on("data", (data: Buffer) => {
        terminal.sendInput(ws, data.toString());
      });

      // Handle terminal resize
      process.stdout.on("resize", () => {
        const newCols = process.stdout.columns ?? 80;
        const newRows = process.stdout.rows ?? 24;
        terminal.resize(ws, newCols, newRows);
      });

      // Handle exit signals
      process.on("SIGINT", cleanup);
      process.on("SIGTERM", cleanup);

      // Keep process alive
      await new Promise(() => {});
    })
  );

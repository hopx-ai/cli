/**
 * cmd command - Shell command execution
 */

import { Command } from "commander";
import chalk from "chalk";
import { Sandbox } from "@hopx-ai/sdk";
import { requireApiKey } from "../lib/auth/token.js";
import { withErrorHandler } from "../lib/errors.js";
import { info } from "../lib/output/progress.js";
import { output } from "../lib/output/index.js";
import { getOutputFormat, getBaseUrl } from "../lib/config.js";

export const cmdCommand = new Command("cmd")
  .description("Execute shell commands in sandboxes");

// cmd run
cmdCommand
  .command("run")
  .description("Execute a shell command")
  .argument("<command>", "Command to execute")
  .requiredOption("-s, --sandbox <id>", "Sandbox ID")
  .option("--timeout <seconds>", "Command timeout", "30")
  .option("-w, --workdir <path>", "Working directory")
  .option("-b, --background", "Run in background")
  .action(
    withErrorHandler(
      async (
        command: string,
        options: {
          sandbox: string;
          timeout: string;
          workdir?: string;
          background?: boolean;
        }
      ) => {
        const apiKey = await requireApiKey();
        const sandbox = await Sandbox.connect(options.sandbox, apiKey, getBaseUrl());
        const timeout = parseInt(options.timeout, 10);

        if (options.background) {
          // Background execution
          const result = await sandbox.commands.run(command, {
            background: true,
            timeoutMs: timeout * 1000,
            workingDir: options.workdir,
          });

          const format = getOutputFormat();
          if (format === "json") {
            output({
              sandbox_id: options.sandbox,
              command,
              background: true,
              pid: result.pid,
              success: result.success,
            });
          } else {
            info(`Background process started`);
            console.log(chalk.gray(`PID: ${result.pid}`));
          }
        } else {
          // Synchronous execution
          const result = await sandbox.commands.run(command, {
            timeoutMs: timeout * 1000,
            workingDir: options.workdir,
          });

          const format = getOutputFormat();
          if (format === "json") {
            output({
              sandbox_id: options.sandbox,
              command,
              exit_code: result.exitCode,
              stdout: result.stdout,
              stderr: result.stderr,
            });
          } else {
            // Print stdout
            if (result.stdout) {
              console.log(result.stdout);
            }

            // Print stderr in red
            if (result.stderr) {
              console.error(chalk.red(result.stderr));
            }

            // Exit code info if non-zero
            if (result.exitCode !== 0) {
              console.log(chalk.yellow(`\nExit code: ${result.exitCode}`));
            }
          }
        }
      }
    )
  );

// cmd background - alias for cmd run --background
cmdCommand
  .command("background")
  .description("Execute a command in background")
  .argument("<command>", "Command to execute")
  .requiredOption("-s, --sandbox <id>", "Sandbox ID")
  .option("--timeout <seconds>", "Command timeout", "300")
  .option("-w, --workdir <path>", "Working directory")
  .action(
    withErrorHandler(
      async (
        command: string,
        options: {
          sandbox: string;
          timeout: string;
          workdir?: string;
        }
      ) => {
        const apiKey = await requireApiKey();
        const sandbox = await Sandbox.connect(options.sandbox, apiKey, getBaseUrl());
        const timeout = parseInt(options.timeout, 10);

        const result = await sandbox.commands.run(command, {
          background: true,
          timeoutMs: timeout * 1000,
          workingDir: options.workdir,
        });

        const format = getOutputFormat();
        if (format === "json") {
          output({
            sandbox_id: options.sandbox,
            command,
            background: true,
            pid: result.pid,
            success: result.success,
          });
        } else {
          info(`Background process started`);
          console.log(chalk.gray(`PID: ${result.pid}`));
        }
      }
    )
  );

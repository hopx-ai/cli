/**
 * shell command - Create a sandbox and open an interactive terminal in one step
 */

import { Command } from "commander";
import chalk from "chalk";
import { Sandbox } from "@hopx-ai/sdk";
import { requireApiKey } from "../lib/auth/token.js";
import { getDefaultTemplate, getDefaultTimeout, getBaseUrl } from "../lib/config.js";
import { withErrorHandler } from "../lib/errors.js";
import { info, withSpinner } from "../lib/output/progress.js";
import { attachInteractiveTerminal } from "../lib/terminal/session.js";

export const shellCommand = new Command("shell")
  .alias("sh")
  .description("Create a sandbox and open an interactive terminal in one step")
  .option("-t, --template <name>", "Template to use")
  .option("--timeout <seconds>", "Auto-kill timeout in seconds")
  .option("-e, --env <key=value...>", "Environment variables")
  .option("--rm", "Kill the sandbox when the terminal session ends")
  .action(
    withErrorHandler(
      async (options: {
        template?: string;
        timeout?: string;
        env?: string[];
        rm?: boolean;
      }) => {
        const apiKey = await requireApiKey();
        const template = options.template ?? getDefaultTemplate();
        const timeout = options.timeout ? parseInt(options.timeout, 10) : getDefaultTimeout();

        // Parse environment variables (key=value pairs).
        const envVars: Record<string, string> = {};
        if (options.env) {
          for (const item of options.env) {
            const [key, ...valueParts] = item.split("=");
            if (key) {
              envVars[key] = valueParts.join("=");
            }
          }
        }

        const sandbox = await withSpinner(
          `Creating sandbox with template: ${template}`,
          () =>
            Sandbox.create({
              template,
              apiKey,
              baseURL: getBaseUrl(),
              timeoutSeconds: timeout,
              envVars: Object.keys(envVars).length > 0 ? envVars : undefined,
            }),
          { successMessage: "Sandbox created!" }
        );

        info(`Sandbox: ${sandbox.sandboxId}`);
        if (options.rm) {
          console.log(chalk.gray("It will be killed when you exit (--rm)."));
        } else {
          console.log(
            chalk.gray(
              `It keeps running after you exit. Reconnect with: hopx terminal ${sandbox.sandboxId}`
            )
          );
        }
        console.log(chalk.gray("Press Ctrl+C to exit\n"));

        await attachInteractiveTerminal(sandbox, {
          onExit: options.rm
            ? async () => {
                try {
                  await sandbox.kill();
                  console.log(chalk.gray(`\nSandbox killed: ${sandbox.sandboxId}`));
                } catch (err) {
                  console.error(
                    chalk.red(
                      `Failed to kill sandbox ${sandbox.sandboxId}: ${
                        err instanceof Error ? err.message : String(err)
                      }`
                    )
                  );
                }
              }
            : undefined,
        });
      }
    )
  );

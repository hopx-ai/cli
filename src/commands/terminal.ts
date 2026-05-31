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
import { attachInteractiveTerminal } from "../lib/terminal/session.js";

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
      await attachInteractiveTerminal(sandbox);
    })
  );

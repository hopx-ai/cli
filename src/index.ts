#!/usr/bin/env bun
/**
 * Hopx CLI - Official command-line interface for Hopx.ai cloud sandboxes
 *
 * Entry point for the CLI application using Commander.js
 */

import { Command } from "commander";
import { version } from "../package.json";

// Command imports
import { authCommand } from "./commands/auth.js";
import { sandboxCommand } from "./commands/sandbox.js";
import { runCommand } from "./commands/run.js";
import { filesCommand } from "./commands/files.js";
import { cmdCommand } from "./commands/cmd.js";
import { envCommand } from "./commands/env.js";
import { terminalCommand } from "./commands/terminal.js";
import { templateCommand } from "./commands/template.js";
import { configCommand } from "./commands/config.js";
import { systemCommand } from "./commands/system.js";
import { initCommand } from "./commands/init.js";
import { orgCommand } from "./commands/org.js";
import { profileCommand } from "./commands/profile.js";
import { membersCommand } from "./commands/members.js";
import { billingCommand } from "./commands/billing.js";
import { usageCommand } from "./commands/usage.js";

// Create the main program
const program = new Command();

program
  .name("hopx")
  .description("Official CLI for Hopx.ai cloud sandboxes")
  .version(version, "-v, --version", "Display version number")
  .option("--api-key <key>", "API key for authentication")
  .option("--profile <name>", "Configuration profile to use", "default")
  .option("-o, --output <format>", "Output format: table, json, plain", "table")
  .option("--no-color", "Disable colored output")
  .hook("preAction", (thisCommand) => {
    // Store global options in command context for subcommands
    const opts = thisCommand.opts();
    process.env.HOPX_CLI_OUTPUT = opts.output;
    if (opts.apiKey) {
      process.env.HOPX_API_KEY = opts.apiKey;
    }
    if (opts.profile) {
      process.env.HOPX_PROFILE = opts.profile;
    }
    if (opts.color === false) {
      process.env.NO_COLOR = "1";
    }
  });

// Register commands
program.addCommand(initCommand);
program.addCommand(authCommand);
program.addCommand(sandboxCommand);
program.addCommand(runCommand);
program.addCommand(filesCommand);
program.addCommand(cmdCommand);
program.addCommand(envCommand);
program.addCommand(terminalCommand);
program.addCommand(templateCommand);
program.addCommand(configCommand);
program.addCommand(systemCommand);
program.addCommand(orgCommand);
program.addCommand(profileCommand);
program.addCommand(membersCommand);
program.addCommand(billingCommand);
program.addCommand(usageCommand);

// Parse arguments and run
program.parse();

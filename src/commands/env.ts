/**
 * env command - Environment variable management
 */

import { Command } from "commander";
import chalk from "chalk";
import { Sandbox } from "@hopx-ai/sdk";
import { requireApiKey } from "../lib/auth/token.js";
import { withErrorHandler, CLIError, ExitCode } from "../lib/errors.js";
import { success, info } from "../lib/output/progress.js";
import { outputList, output } from "../lib/output/index.js";
import { getOutputFormat, getBaseUrl } from "../lib/config.js";

export const envCommand = new Command("env")
  .description("Environment variable management in sandboxes");

// env list
envCommand
  .command("list")
  .description("List all environment variables")
  .requiredOption("-s, --sandbox <id>", "Sandbox ID")
  .action(
    withErrorHandler(async (options: { sandbox: string }) => {
      const apiKey = await requireApiKey();
      const sandbox = await Sandbox.connect(options.sandbox, apiKey, getBaseUrl());

      const vars = await sandbox.env.getAll();

      if (Object.keys(vars).length === 0) {
        info("No environment variables set");
        return;
      }

      const format = getOutputFormat();
      if (format === "json") {
        output(vars);
      } else {
        outputList(
          Object.entries(vars).map(([key, value]) => ({
            key,
            value: maskSensitive(key, value),
          })),
          {
            title: "Environment Variables",
            columns: [
              { key: "key", header: "Name" },
              { key: "value", header: "Value" },
            ],
          }
        );
      }
    })
  );

// env get
envCommand
  .command("get")
  .description("Get an environment variable")
  .argument("<name>", "Variable name")
  .requiredOption("-s, --sandbox <id>", "Sandbox ID")
  .action(
    withErrorHandler(async (name: string, options: { sandbox: string }) => {
      const apiKey = await requireApiKey();
      const sandbox = await Sandbox.connect(options.sandbox, apiKey, getBaseUrl());

      const value = await sandbox.env.get(name);

      if (value === undefined) {
        info(`Variable not set: ${name}`);
        return;
      }

      const format = getOutputFormat();
      if (format === "json") {
        output({ name, value });
      } else {
        console.log(value);
      }
    })
  );

// env set
envCommand
  .command("set")
  .description("Set environment variables")
  .argument("<vars...>", "Variables in KEY=VALUE format")
  .requiredOption("-s, --sandbox <id>", "Sandbox ID")
  .action(
    withErrorHandler(async (vars: string[], options: { sandbox: string }) => {
      const apiKey = await requireApiKey();
      const sandbox = await Sandbox.connect(options.sandbox, apiKey, getBaseUrl());

      // Parse KEY=VALUE pairs
      const envVars: Record<string, string> = {};
      for (const item of vars) {
        const eqIndex = item.indexOf("=");
        if (eqIndex === -1) {
          throw new CLIError(
            `Invalid format: ${item}. Use KEY=VALUE`,
            ExitCode.ValidationError
          );
        }
        const key = item.slice(0, eqIndex);
        const value = item.slice(eqIndex + 1);
        envVars[key] = value;
      }

      await sandbox.env.update(envVars);

      const keys = Object.keys(envVars);
      success(`Set ${keys.length} variable(s): ${keys.join(", ")}`);
    })
  );

// env unset
envCommand
  .command("unset")
  .description("Unset environment variables")
  .argument("<names...>", "Variable names to unset")
  .requiredOption("-s, --sandbox <id>", "Sandbox ID")
  .action(
    withErrorHandler(async (names: string[], options: { sandbox: string }) => {
      const apiKey = await requireApiKey();
      const sandbox = await Sandbox.connect(options.sandbox, apiKey, getBaseUrl());

      // Set variables to empty string to effectively unset them
      const envVars: Record<string, string> = {};
      for (const name of names) {
        envVars[name] = "";
      }

      await sandbox.env.update(envVars);
      success(`Unset ${names.length} variable(s): ${names.join(", ")}`);
    })
  );

/**
 * Mask sensitive variable values
 */
function maskSensitive(key: string, value: string): string {
  const sensitivePatterns = ["KEY", "SECRET", "TOKEN", "PASSWORD", "CREDENTIAL"];
  const upperKey = key.toUpperCase();

  if (sensitivePatterns.some((pattern) => upperKey.includes(pattern))) {
    if (value.length <= 8) {
      return "***MASKED***";
    }
    return value.slice(0, 4) + "..." + value.slice(-4);
  }

  return value;
}

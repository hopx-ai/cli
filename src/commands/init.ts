/**
 * init command - First-run setup wizard
 */

import { Command } from "commander";
import chalk from "chalk";
import { createInterface } from "readline";
import { ensureConfigDir, saveConfig, loadConfig, setProfileValue } from "../lib/config.js";
import { saveApiKey, isKeyringAvailable } from "../lib/auth/credentials.js";
import { isValidApiKeyFormat } from "../lib/auth/token.js";
import { success, info, warn } from "../lib/output/progress.js";
import { withErrorHandler } from "../lib/errors.js";

export const initCommand = new Command("init")
  .description("First-run setup wizard for Hopx CLI")
  .action(
    withErrorHandler(async () => {
      console.log(chalk.bold("\nWelcome to Hopx CLI!\n"));
      console.log("This wizard will help you set up your configuration.\n");

      // Check keyring availability
      if (isKeyringAvailable()) {
        info("Secure credential storage is available (system keyring)");
      } else {
        warn("System keyring not available. Credentials will be stored in ~/.hopx/credentials.yaml");
      }

      // Ensure config directory exists
      ensureConfigDir();
      info(`Configuration directory: ~/.hopx/`);

      // Prompt for API key
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const question = (prompt: string): Promise<string> =>
        new Promise((resolve) => {
          rl.question(prompt, resolve);
        });

      console.log(chalk.cyan("\nAPI Key Setup"));
      console.log(chalk.gray("Get your API key from: https://hopx.ai/dashboard\n"));

      const apiKey = await question("Enter your API key (or press Enter to skip): ");

      if (apiKey.trim()) {
        if (isValidApiKeyFormat(apiKey.trim())) {
          await saveApiKey(apiKey.trim());
          success("API key saved securely");
        } else {
          warn("API key format doesn't match expected pattern (hopx_live_* or hopx_test_*)");
          const saveAnyway = await question("Save anyway? (y/N): ");
          if (saveAnyway.toLowerCase() === "y") {
            await saveApiKey(apiKey.trim());
            success("API key saved");
          }
        }
      } else {
        info("Skipped API key setup. You can set it later with:");
        console.log(chalk.gray("  export HOPX_API_KEY=your_key"));
        console.log(chalk.gray("  # or"));
        console.log(chalk.gray("  hopx auth login"));
      }

      // Default template
      console.log(chalk.cyan("\nDefault Template"));
      console.log(chalk.gray("Available: python, nodejs, base\n"));

      const template = await question("Default template (python): ");
      if (template.trim()) {
        setProfileValue("default_template", template.trim());
        success(`Default template set to: ${template.trim()}`);
      } else {
        info("Using default template: python");
      }

      // Output format
      console.log(chalk.cyan("\nOutput Format"));
      console.log(chalk.gray("Options: table, json, plain\n"));

      const outputFormat = await question("Default output format (table): ");
      if (outputFormat.trim() && ["table", "json", "plain"].includes(outputFormat.trim())) {
        setProfileValue("output_format", outputFormat.trim());
        success(`Default output format set to: ${outputFormat.trim()}`);
      } else if (outputFormat.trim()) {
        warn("Invalid format. Using default: table");
      }

      rl.close();

      // Summary
      console.log(chalk.bold("\nSetup Complete!\n"));
      console.log("Quick start:");
      console.log(chalk.gray("  hopx sandbox create          # Create a sandbox"));
      console.log(chalk.gray("  hopx run 'print(\"hello\")'    # Run code"));
      console.log(chalk.gray("  hopx --help                  # See all commands"));
      console.log();
      console.log(chalk.cyan("Documentation: https://docs.hopx.ai/cli"));
      console.log();
    })
  );

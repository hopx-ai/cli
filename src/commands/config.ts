/**
 * config command - Configuration management
 */

import { Command } from "commander";
import chalk from "chalk";
import {
  loadConfig,
  saveConfig,
  getProfile,
  setProfileValue,
  listProfiles,
  createProfile,
  deleteProfile,
  setDefaultProfile,
  getConfigPath,
  type ProfileConfig,
} from "../lib/config.js";
import { withErrorHandler, CLIError, ExitCode } from "../lib/errors.js";
import { success, info, warn } from "../lib/output/progress.js";
import { output, outputList } from "../lib/output/index.js";

export const configCommand = new Command("config")
  .description("Configuration management");

// config show
configCommand
  .command("show")
  .description("Display current configuration")
  .option("-p, --profile <name>", "Profile to show")
  .action(
    withErrorHandler(async (options: { profile?: string }) => {
      const config = loadConfig();

      if (options.profile) {
        const profile = config.profiles[options.profile];
        if (!profile) {
          throw new CLIError(`Profile not found: ${options.profile}`, ExitCode.NotFoundError);
        }
        output(
          {
            profile: options.profile,
            ...profile,
            api_key: profile.api_key ? maskApiKey(profile.api_key) : undefined,
          },
          { keyValueTitle: `Profile: ${options.profile}` }
        );
      } else {
        output(
          {
            config_file: getConfigPath(),
            default_profile: config.default_profile,
            profiles: Object.keys(config.profiles).join(", "),
          },
          { keyValueTitle: "Configuration" }
        );

        console.log(chalk.gray("\nUse 'hopx config show --profile <name>' to see profile details"));
      }
    })
  );

// config get
configCommand
  .command("get")
  .description("Get a configuration value")
  .argument("<key>", "Configuration key")
  .option("-p, --profile <name>", "Profile to read from", "default")
  .action(
    withErrorHandler(async (key: string, options: { profile: string }) => {
      const profile = getProfile(options.profile);
      const value = profile[key as keyof ProfileConfig];

      if (value === undefined) {
        info(`Key not set: ${key}`);
        return;
      }

      // Mask API key
      if (key === "api_key" && typeof value === "string") {
        console.log(maskApiKey(value));
      } else {
        console.log(value);
      }
    })
  );

// config set
configCommand
  .command("set")
  .description("Set a configuration value")
  .argument("<key>", "Configuration key")
  .argument("<value>", "Configuration value")
  .option("-p, --profile <name>", "Profile to write to", "default")
  .action(
    withErrorHandler(async (key: string, value: string, options: { profile: string }) => {
      const validKeys: Array<keyof ProfileConfig> = [
        "api_key",
        "base_url",
        "default_template",
        "default_timeout",
        "output_format",
      ];

      if (!validKeys.includes(key as keyof ProfileConfig)) {
        throw new CLIError(
          `Invalid key: ${key}. Valid keys: ${validKeys.join(", ")}`,
          ExitCode.ValidationError
        );
      }

      // Validate output_format
      if (key === "output_format" && !["table", "json", "plain"].includes(value)) {
        throw new CLIError(
          `Invalid output format: ${value}. Valid formats: table, json, plain`,
          ExitCode.ValidationError
        );
      }

      setProfileValue(key as keyof ProfileConfig, value, options.profile);
      success(`Set ${key} = ${key === "api_key" ? maskApiKey(value) : value}`);
    })
  );

// config profile - subcommand group
const profileCommand = new Command("profile")
  .description("Manage configuration profiles");

profileCommand
  .command("list")
  .description("List all profiles")
  .action(
    withErrorHandler(async () => {
      const config = loadConfig();
      const profiles = listProfiles();

      outputList(
        profiles.map((name) => ({
          name,
          default: name === config.default_profile ? "Yes" : "",
          api_key: config.profiles[name].api_key ? "Set" : "-",
          template: config.profiles[name].default_template ?? "-",
        })),
        {
          title: "Configuration Profiles",
          columns: [
            { key: "name", header: "Name" },
            { key: "default", header: "Default" },
            { key: "api_key", header: "API Key" },
            { key: "template", header: "Template" },
          ],
        }
      );
    })
  );

profileCommand
  .command("create")
  .description("Create a new profile")
  .argument("<name>", "Profile name")
  .action(
    withErrorHandler(async (name: string) => {
      const profiles = listProfiles();
      if (profiles.includes(name)) {
        throw new CLIError(`Profile already exists: ${name}`, ExitCode.ValidationError);
      }

      createProfile(name);
      success(`Profile created: ${name}`);
      console.log(chalk.gray(`Configure with: hopx config set <key> <value> --profile ${name}`));
    })
  );

profileCommand
  .command("delete")
  .description("Delete a profile")
  .argument("<name>", "Profile name")
  .action(
    withErrorHandler(async (name: string) => {
      if (name === "default") {
        throw new CLIError("Cannot delete the default profile", ExitCode.ValidationError);
      }

      const result = deleteProfile(name);
      if (!result) {
        throw new CLIError(`Profile not found: ${name}`, ExitCode.NotFoundError);
      }

      success(`Profile deleted: ${name}`);
    })
  );

profileCommand
  .command("use")
  .description("Set the default profile")
  .argument("<name>", "Profile name")
  .action(
    withErrorHandler(async (name: string) => {
      const result = setDefaultProfile(name);
      if (!result) {
        throw new CLIError(`Profile not found: ${name}`, ExitCode.NotFoundError);
      }

      success(`Default profile set to: ${name}`);
    })
  );

configCommand.addCommand(profileCommand);

/**
 * Mask an API key for display
 */
function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 12) {
    return "***" + apiKey.slice(-4);
  }
  return apiKey.slice(0, 8) + "..." + apiKey.slice(-4);
}

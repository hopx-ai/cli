/**
 * org command - Organization settings
 */

import { Command } from "commander";
import { requireApiKey } from "../lib/auth/token.js";
import { getBaseUrl } from "../lib/config.js";
import { withErrorHandler, CLIError, ExitCode } from "../lib/errors.js";
import { output } from "../lib/output/index.js";

export const orgCommand = new Command("org")
  .description("Organization settings");

// org info
orgCommand
  .command("info")
  .description("Show organization information")
  .action(
    withErrorHandler(async () => {
      const apiKey = await requireApiKey();
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/organization`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new CLIError(
          `Failed to get organization info: ${response.statusText}`,
          ExitCode.GeneralError
        );
      }

      const org = (await response.json()) as Record<string, unknown>;
      output(org, { keyValueTitle: "Organization" });
    })
  );

// org settings
orgCommand
  .command("settings")
  .description("Show organization settings")
  .action(
    withErrorHandler(async () => {
      const apiKey = await requireApiKey();
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/organization/settings`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new CLIError(
          `Failed to get organization settings: ${response.statusText}`,
          ExitCode.GeneralError
        );
      }

      const settings = (await response.json()) as Record<string, unknown>;
      output(settings, { keyValueTitle: "Organization Settings" });
    })
  );

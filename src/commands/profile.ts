/**
 * profile command - User profile
 */

import { Command } from "commander";
import { requireApiKey } from "../lib/auth/token.js";
import { getBaseUrl } from "../lib/config.js";
import { withErrorHandler, CLIError, ExitCode } from "../lib/errors.js";
import { output } from "../lib/output/index.js";

export const profileCommand = new Command("profile")
  .description("User profile management");

// profile info (default)
profileCommand
  .command("info", { isDefault: true })
  .description("Show user profile")
  .action(
    withErrorHandler(async () => {
      const apiKey = await requireApiKey();
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/me`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new CLIError(
          `Failed to get profile: ${response.statusText}`,
          ExitCode.GeneralError
        );
      }

      const profile = (await response.json()) as Record<string, unknown>;
      output(profile, { keyValueTitle: "User Profile" });
    })
  );

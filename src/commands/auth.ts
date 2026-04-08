/**
 * auth command - Authentication management
 */

import { Command } from "commander";
import chalk from "chalk";
import { createInterface } from "readline";
import {
  saveApiKey,
  saveTokens,
  deleteCredentials,
  hasCredentials,
  isKeyringAvailable,
} from "../lib/auth/credentials.js";
import { startOAuthLogin, DEFAULT_PROVIDER } from "../lib/auth/oauth.js";
import { fetchProvidersWithFallback, pickProvider } from "../lib/auth/providers.js";
import { getAuthStatus, requireApiKey, isValidApiKeyFormat } from "../lib/auth/token.js";
import { withErrorHandler, CLIError, ExitCode } from "../lib/errors.js";
import { success, info, warn, error, withSpinner } from "../lib/output/progress.js";
import { output, outputList } from "../lib/output/index.js";
import { getBaseUrl } from "../lib/config.js";

export const authCommand = new Command("auth")
  .description("Authentication management");

// auth login
authCommand
  .command("login")
  .description("Authenticate with Hopx")
  .option("--api-key <key>", "Use API key directly instead of browser login")
  .option(
    "--provider <provider>",
    "OAuth provider ID (e.g. GoogleOAuth, GitHubOAuth, MicrosoftOAuth). " +
      "If omitted, the CLI fetches the list from the server and prompts."
  )
  .option("-p, --profile <name>", "Profile to save credentials to", "default")
  .action(
    withErrorHandler(async (options: { apiKey?: string; provider?: string; profile: string }) => {
      if (options.apiKey) {
        // Direct API key login
        if (!isValidApiKeyFormat(options.apiKey)) {
          warn("API key format doesn't match expected pattern");
        }

        await saveApiKey(options.apiKey, options.profile);
        success(`API key saved to profile: ${options.profile}`);
        return;
      }

      // Browser-based OAuth login
      info(isKeyringAvailable()
        ? "Credentials will be stored in system keyring"
        : "Credentials will be stored in ~/.hopx/credentials.yaml"
      );

      // Determine which OAuth provider to use.
      //
      //  1. --provider wins (for scripts and users who know their IdP)
      //  2. Otherwise, if we're on a TTY, fetch the list from
      //     GET /auth/providers and show a terminal picker
      //  3. Otherwise (piped, CI, no TTY), fall back to the default
      //     silently so non-interactive usage still works
      let provider: string;
      if (options.provider) {
        provider = options.provider;
      } else if (process.stdin.isTTY) {
        const baseUrl = getBaseUrl(options.profile);
        const { providers, fromServer } = await fetchProvidersWithFallback(baseUrl);
        if (!fromServer) {
          warn("Could not fetch the provider list from the server; using a built-in fallback.");
        }
        provider = await pickProvider(providers);
      } else {
        provider = DEFAULT_PROVIDER;
      }

      const result = await withSpinner(
        "Waiting for browser authentication...",
        () => startOAuthLogin(provider),
        { successMessage: "Authentication successful!" }
      );

      // Persist OAuth tokens so `hopx auth status` reports authenticated
      // and subsequent commands that need an access token can read it.
      // The WorkOS flow returns an access_token (always), refresh_token
      // (optional), and expires_at (optional unix timestamp).
      if (result.accessToken) {
        await saveTokens(
          {
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            expiresAt: result.expiresAt,
          },
          options.profile
        );
      }

      // Legacy path: if the flow ever returns an apiKey directly (it
      // doesn't today, but the OAuthResult shape supports it), save it.
      if (result.apiKey) {
        await saveApiKey(result.apiKey, options.profile);
        success(`API key saved to profile: ${options.profile}`);
      }

      console.log(chalk.green("\nYou're now logged in!"));
      console.log(chalk.gray("Run 'hopx sandbox create' to get started."));
    })
  );

// auth logout
authCommand
  .command("logout")
  .description("Clear stored credentials")
  .option("-p, --profile <name>", "Profile to clear", "default")
  .option("--all", "Clear all profiles")
  .action(
    withErrorHandler(async (options: { profile: string; all?: boolean }) => {
      if (options.all) {
        // TODO: Clear all profiles
        await deleteCredentials("default");
        success("All credentials cleared");
      } else {
        await deleteCredentials(options.profile);
        success(`Credentials cleared for profile: ${options.profile}`);
      }
    })
  );

// auth status
authCommand
  .command("status")
  .description("Show current authentication status")
  .option("-p, --profile <name>", "Profile to check", "default")
  .action(
    withErrorHandler(async (options: { profile: string }) => {
      const status = await getAuthStatus(options.profile);

      output({
        profile: status.profile,
        authenticated: status.authenticated ? "Yes" : "No",
        method: status.method ?? "-",
        api_key: status.apiKeyPrefix ?? "-",
        expires_at: status.expiresAt?.toISOString() ?? "-",
        needs_refresh: status.needsRefresh ? "Yes" : "No",
        keyring_available: isKeyringAvailable() ? "Yes" : "No",
      }, { keyValueTitle: "Authentication Status" });

      if (!status.authenticated) {
        console.log(chalk.yellow('\nNot authenticated. Run "hopx auth login" to authenticate.'));
      } else if (status.needsRefresh) {
        console.log(chalk.yellow("\nToken will expire soon. Consider refreshing."));
      }
    })
  );

// auth api-keys - subcommand group
const apiKeysCommand = new Command("api-keys")
  .description("Manage API keys");

apiKeysCommand
  .command("list")
  .description("List your API keys")
  .action(
    withErrorHandler(async () => {
      const apiKey = await requireApiKey();
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/api-keys`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new CLIError(`Failed to list API keys: ${response.statusText}`, ExitCode.GeneralError);
      }

      const data = await response.json() as { keys: Array<{ id: string; name: string; prefix: string; created_at: string; last_used_at?: string }> };

      outputList(data.keys, {
        title: "API Keys",
        columns: [
          { key: "id", header: "ID" },
          { key: "name", header: "Name" },
          { key: "prefix", header: "Prefix" },
          { key: "created_at", header: "Created" },
          { key: "last_used_at", header: "Last Used" },
        ],
      });
    })
  );

apiKeysCommand
  .command("create")
  .description("Create a new API key")
  .requiredOption("-n, --name <name>", "Name for the API key")
  .action(
    withErrorHandler(async (options: { name: string }) => {
      const apiKey = await requireApiKey();
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/api-keys`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: options.name }),
      });

      if (!response.ok) {
        throw new CLIError(`Failed to create API key: ${response.statusText}`, ExitCode.GeneralError);
      }

      const data = await response.json() as { key: string; id: string };

      success(`API key created: ${options.name}`);
      console.log(chalk.yellow("\nIMPORTANT: Save this key now. You won't be able to see it again."));
      console.log(chalk.bold(`\n${data.key}\n`));
    })
  );

apiKeysCommand
  .command("revoke")
  .description("Revoke an API key")
  .argument("<id>", "API key ID to revoke")
  .option("-y, --yes", "Skip confirmation")
  .action(
    withErrorHandler(async (id: string, options: { yes?: boolean }) => {
      if (!options.yes) {
        const rl = createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise<string>((resolve) => {
          rl.question(chalk.yellow(`Are you sure you want to revoke API key ${id}? (y/N): `), resolve);
        });
        rl.close();

        if (answer.toLowerCase() !== "y") {
          info("Cancelled");
          return;
        }
      }

      const apiKey = await requireApiKey();
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/api-keys/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new CLIError(`Failed to revoke API key: ${response.statusText}`, ExitCode.GeneralError);
      }

      success(`API key revoked: ${id}`);
    })
  );

authCommand.addCommand(apiKeysCommand);

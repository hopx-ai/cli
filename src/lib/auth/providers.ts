/**
 * Auth provider discovery and selection.
 *
 * The Hopx backend exposes `GET /auth/providers` (no auth required)
 * which returns the list of configured identity providers. See
 * public-api/internal/api/auth_handlers.go:handleGetAuthProviders.
 *
 * This module fetches that list and, in interactive terminals, shows
 * a small picker so users can choose Google / GitHub / Microsoft /
 * whatever the server has configured. The list is server-driven, so
 * adding a new provider (e.g. SAML SSO) does not require a CLI
 * release — the new entry shows up in the picker automatically.
 */

import { createInterface } from "readline";
import chalk from "chalk";

export interface AuthProviderInfo {
  id: string;     // WorkOS connection ID, e.g. "GoogleOAuth"
  name: string;   // Display name, e.g. "Google"
  icon?: string;  // Optional icon hint (unused by the CLI)
}

// Static fallback used when the server is unreachable or returns an
// empty list. Matches the providers the Python CLI whitelists.
const DEFAULT_FALLBACK_PROVIDERS: AuthProviderInfo[] = [
  { id: "GoogleOAuth", name: "Google" },
  { id: "GitHubOAuth", name: "GitHub" },
  { id: "MicrosoftOAuth", name: "Microsoft" },
];

const PROVIDERS_TIMEOUT_MS = 5_000;

/**
 * Fetch the configured auth providers from the Hopx backend.
 * Throws on network failure, non-2xx response, or empty list.
 */
export async function fetchProviders(baseUrl: string): Promise<AuthProviderInfo[]> {
  const url = `${baseUrl}/auth/providers`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDERS_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    const data = (await response.json()) as { providers?: AuthProviderInfo[] };
    if (!Array.isArray(data.providers) || data.providers.length === 0) {
      throw new Error("empty provider list");
    }
    return data.providers;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch providers, falling back to a static list on any error.
 * The second return value indicates whether the list came from the
 * server (true) or the static fallback (false) — callers can use it
 * to decide whether to print a warning.
 */
export async function fetchProvidersWithFallback(
  baseUrl: string
): Promise<{ providers: AuthProviderInfo[]; fromServer: boolean }> {
  try {
    const providers = await fetchProviders(baseUrl);
    return { providers, fromServer: true };
  } catch {
    return { providers: DEFAULT_FALLBACK_PROVIDERS, fromServer: false };
  }
}

/**
 * Prompt the user to pick a provider via a numbered readline prompt.
 * Single-element lists resolve immediately without prompting. Caller
 * is responsible for checking `process.stdin.isTTY` before calling —
 * this function will hang in non-interactive environments.
 */
export async function pickProvider(providers: AuthProviderInfo[]): Promise<string> {
  if (providers.length === 0) {
    throw new Error("No providers to pick from");
  }
  if (providers.length === 1) {
    return providers[0].id;
  }

  console.log(chalk.bold("\nChoose a sign-in provider:"));
  providers.forEach((p, i) => {
    console.log(`  ${chalk.cyan(`${i + 1})`)} ${p.name}`);
  });
  console.log();

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    // Loop until the user enters a valid choice. Pressing Enter with
    // no input picks the first provider (typical "default [1]" UX).
    while (true) {
      const answer = await new Promise<string>((resolve) => {
        rl.question(`Enter choice [1-${providers.length}, default 1]: `, resolve);
      });

      const trimmed = answer.trim();
      const pick = trimmed === "" ? 1 : parseInt(trimmed, 10);

      if (Number.isInteger(pick) && pick >= 1 && pick <= providers.length) {
        return providers[pick - 1].id;
      }

      console.log(
        chalk.yellow(`Invalid choice. Enter a number between 1 and ${providers.length}.`)
      );
    }
  } finally {
    rl.close();
  }
}

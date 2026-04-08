/**
 * Token management for Hopx CLI
 * Handles API key retrieval and token refresh
 */

import { getApiKey as getApiKeyFromCredentials, getTokens, saveTokens } from "./credentials.js";
import { getApiKey as getApiKeyFromConfig, getBaseUrl } from "../config.js";
import { CLIError, ExitCode } from "../errors.js";

const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000; // 5 minutes before expiry

interface AuthStatus {
  authenticated: boolean;
  method?: "api_key" | "oauth";
  profile: string;
  apiKeyPrefix?: string;
  expiresAt?: Date;
  needsRefresh?: boolean;
}

/**
 * Get the API key to use for requests
 * Checks environment, config, and credentials in order
 */
export async function getApiKey(profile: string = "default"): Promise<string | undefined> {
  // 1. Environment variable (highest priority)
  if (process.env.HOPX_API_KEY) {
    return process.env.HOPX_API_KEY;
  }

  // 2. Credentials store (keyring/file)
  const storedKey = await getApiKeyFromCredentials(profile);
  if (storedKey) {
    return storedKey;
  }

  // 3. Config file
  return getApiKeyFromConfig(profile);
}

/**
 * Require an API key, throwing if not available
 */
export async function requireApiKey(profile: string = "default"): Promise<string> {
  const apiKey = await getApiKey(profile);

  if (!apiKey) {
    throw new CLIError(
      "No API key configured",
      ExitCode.AuthenticationError,
      'Set HOPX_API_KEY environment variable or run "hopx auth login"'
    );
  }

  return apiKey;
}

/**
 * Check if token needs refresh (within margin of expiry)
 */
function needsTokenRefresh(expiresAt?: Date): boolean {
  if (!expiresAt) return false;
  return Date.now() >= expiresAt.getTime() - TOKEN_REFRESH_MARGIN_MS;
}

/**
 * Refresh OAuth token if needed
 */
export async function refreshTokenIfNeeded(profile: string = "default"): Promise<void> {
  const tokens = await getTokens(profile);

  if (!tokens.refreshToken || !tokens.expiresAt) {
    return; // No refresh token or no expiry, nothing to refresh
  }

  if (!needsTokenRefresh(tokens.expiresAt)) {
    return; // Token still valid
  }

  // Attempt refresh
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      refresh_token: tokens.refreshToken,
    }),
  });

  if (!response.ok) {
    throw new CLIError(
      "Failed to refresh authentication token",
      ExitCode.AuthenticationError,
      'Run "hopx auth login" to re-authenticate'
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const newExpiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : undefined;

  await saveTokens(
    {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? tokens.refreshToken,
      expiresAt: newExpiresAt,
    },
    profile
  );
}

/**
 * Get current authentication status
 */
export async function getAuthStatus(profile: string = "default"): Promise<AuthStatus> {
  const apiKey = await getApiKey(profile);
  const tokens = await getTokens(profile);

  // Check API key
  if (apiKey) {
    return {
      authenticated: true,
      method: "api_key",
      profile,
      apiKeyPrefix: maskApiKey(apiKey),
    };
  }

  // Check OAuth tokens
  if (tokens.accessToken) {
    const expired = tokens.expiresAt ? tokens.expiresAt < new Date() : false;
    const needsRefresh = needsTokenRefresh(tokens.expiresAt);

    return {
      authenticated: !expired,
      method: "oauth",
      profile,
      expiresAt: tokens.expiresAt,
      needsRefresh,
    };
  }

  return {
    authenticated: false,
    profile,
  };
}

/**
 * Mask an API key for display
 */
function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 12) {
    return "***" + apiKey.slice(-4);
  }
  return apiKey.slice(0, 8) + "..." + apiKey.slice(-4);
}

/**
 * Validate an API key format
 */
export function isValidApiKeyFormat(apiKey: string): boolean {
  // API keys should start with hopx_live_ or hopx_test_
  return /^hopx_(live|test)_[a-zA-Z0-9]+\.[a-zA-Z0-9]+$/.test(apiKey);
}

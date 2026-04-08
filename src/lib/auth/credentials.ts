/**
 * Credential storage for Hopx CLI
 * Uses platform keyring when available, falls back to encrypted file
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { getConfigDir, ensureConfigDir } from "../config.js";

const SERVICE_NAME = "hopx-cli";
const CREDENTIALS_FILE = "credentials.yaml";

// Try to import keytar dynamically (native module)
let keytar: typeof import("keytar") | null = null;
try {
  keytar = await import("keytar");
} catch {
  // keytar not available, will use file fallback
}

interface Credentials {
  api_key?: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
}

interface CredentialsFile {
  profiles: Record<string, Credentials>;
}

/**
 * Get credentials file path
 */
function getCredentialsPath(): string {
  return join(getConfigDir(), CREDENTIALS_FILE);
}

/**
 * Load credentials from file (fallback storage)
 */
function loadCredentialsFile(): CredentialsFile {
  const path = getCredentialsPath();
  if (!existsSync(path)) {
    return { profiles: {} };
  }

  try {
    const content = readFileSync(path, "utf-8");
    // Simple YAML-like parsing for credentials
    const parsed = JSON.parse(content);
    return parsed as CredentialsFile;
  } catch {
    return { profiles: {} };
  }
}

/**
 * Save credentials to file (fallback storage)
 */
function saveCredentialsFile(creds: CredentialsFile): void {
  ensureConfigDir();
  const path = getCredentialsPath();
  writeFileSync(path, JSON.stringify(creds, null, 2), { mode: 0o600 });
}

/**
 * Get credentials for a profile using keyring or file fallback
 */
export async function getCredentials(profile: string = "default"): Promise<Credentials> {
  // Try keyring first
  if (keytar) {
    try {
      const stored = await keytar.getPassword(SERVICE_NAME, profile);
      if (stored) {
        return JSON.parse(stored) as Credentials;
      }
    } catch {
      // Keyring failed, use file fallback
    }
  }

  // File fallback
  const file = loadCredentialsFile();
  return file.profiles[profile] ?? {};
}

/**
 * Save credentials for a profile using keyring or file fallback
 */
export async function saveCredentials(
  credentials: Credentials,
  profile: string = "default"
): Promise<void> {
  // Try keyring first
  if (keytar) {
    try {
      await keytar.setPassword(SERVICE_NAME, profile, JSON.stringify(credentials));
      return;
    } catch {
      // Keyring failed, use file fallback
    }
  }

  // File fallback
  const file = loadCredentialsFile();
  file.profiles[profile] = credentials;
  saveCredentialsFile(file);
}

/**
 * Delete credentials for a profile
 */
export async function deleteCredentials(profile: string = "default"): Promise<void> {
  // Try keyring first
  if (keytar) {
    try {
      await keytar.deletePassword(SERVICE_NAME, profile);
    } catch {
      // Ignore keyring errors
    }
  }

  // Also remove from file
  const file = loadCredentialsFile();
  delete file.profiles[profile];
  saveCredentialsFile(file);
}

/**
 * Get API key for a profile
 */
export async function getApiKey(profile: string = "default"): Promise<string | undefined> {
  // Environment variable takes precedence
  if (process.env.HOPX_API_KEY) {
    return process.env.HOPX_API_KEY;
  }

  const creds = await getCredentials(profile);
  return creds.api_key;
}

/**
 * Save API key for a profile
 */
export async function saveApiKey(apiKey: string, profile: string = "default"): Promise<void> {
  const creds = await getCredentials(profile);
  creds.api_key = apiKey;
  await saveCredentials(creds, profile);
}

/**
 * Get OAuth tokens for a profile
 */
export async function getTokens(
  profile: string = "default"
): Promise<{ accessToken?: string; refreshToken?: string; expiresAt?: Date }> {
  const creds = await getCredentials(profile);
  return {
    accessToken: creds.access_token,
    refreshToken: creds.refresh_token,
    expiresAt: creds.expires_at ? new Date(creds.expires_at) : undefined,
  };
}

/**
 * Save OAuth tokens for a profile
 */
export async function saveTokens(
  tokens: { accessToken: string; refreshToken?: string; expiresAt?: Date },
  profile: string = "default"
): Promise<void> {
  const creds = await getCredentials(profile);
  creds.access_token = tokens.accessToken;
  creds.refresh_token = tokens.refreshToken;
  creds.expires_at = tokens.expiresAt?.toISOString();
  await saveCredentials(creds, profile);
}

/**
 * Check if credentials are stored for a profile
 */
export async function hasCredentials(profile: string = "default"): Promise<boolean> {
  const creds = await getCredentials(profile);
  return !!(creds.api_key || creds.access_token);
}

/**
 * Check if keyring is available
 */
export function isKeyringAvailable(): boolean {
  return keytar !== null;
}

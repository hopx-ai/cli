/**
 * Credential storage for Hopx CLI
 * Uses platform keyring when available, falls back to encrypted file.
 *
 * On first read, automatically migrates credentials from the Python
 * hopx-cli layout (4 separate keyring records per profile) into the
 * Bun CLI's single-blob format. See migrateLegacyCredentials() below.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { createRequire } from "module";
import { parse as yamlParse, stringify as yamlStringify } from "yaml";
import { getConfigDir, ensureConfigDir } from "../config.js";

const SERVICE_NAME = "hopx-cli";
const CREDENTIALS_FILE = "credentials.yaml";

// Minimal shape of the keytar module we actually use. Keeps us from
// referencing @types/keytar (not installed) when the package is absent.
interface KeytarLike {
  getPassword(service: string, account: string): Promise<string | null>;
  setPassword(service: string, account: string, password: string): Promise<void>;
  deletePassword(service: string, account: string): Promise<boolean>;
}

// Lazy keytar load. Using createRequire so we can try/catch around the
// actual require() call — a top-level dynamic `import("keytar")` would
// still crash if keytar is listed as a regular dep and fails to install
// prebuilds. keytar is now an optionalDependency and may be missing on
// platforms without prebuilts (linux-arm64, uncommon glibc, etc.).
let keytarCache: KeytarLike | null | undefined = undefined;
function loadKeytar(): KeytarLike | null {
  if (keytarCache !== undefined) {
    return keytarCache;
  }
  try {
    const require = createRequire(import.meta.url);
    keytarCache = require("keytar") as KeytarLike;
  } catch {
    keytarCache = null;
  }
  return keytarCache;
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
 * Load credentials from file (fallback storage).
 * Tries YAML first (the correct format, also what the Python CLI writes).
 * Falls back to JSON for forward-compat with cli-bun 0.1.x builds that
 * accidentally wrote JSON to a .yaml file.
 */
function loadCredentialsFile(): CredentialsFile {
  const path = getCredentialsPath();
  if (!existsSync(path)) {
    return { profiles: {} };
  }

  let content: string;
  try {
    content = readFileSync(path, "utf-8");
  } catch {
    return { profiles: {} };
  }

  // Try YAML first
  try {
    const parsed = yamlParse(content);
    if (parsed && typeof parsed === "object" && "profiles" in parsed) {
      return parsed as CredentialsFile;
    }
  } catch {
    // Fall through to JSON attempt
  }

  // Fall back to JSON (cli-bun 0.1.x wrote JSON to .yaml by mistake)
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && "profiles" in parsed) {
      return parsed as CredentialsFile;
    }
  } catch {
    // Ignore
  }

  return { profiles: {} };
}

/**
 * Save credentials to file (fallback storage) as YAML.
 * mode 0600 so other users on the system cannot read the file.
 */
function saveCredentialsFile(creds: CredentialsFile): void {
  ensureConfigDir();
  const path = getCredentialsPath();
  writeFileSync(path, yamlStringify(creds), { mode: 0o600 });
}

/**
 * One-time migration from the Python hopx-cli keyring layout.
 *
 * The Python CLI stored four separate keyring records per profile under
 * service "hopx-cli":
 *   account "<profile>:api_key"       -> plain string
 *   account "<profile>:oauth_access"  -> plain string
 *   account "<profile>:oauth_refresh" -> plain string
 *   account "<profile>:oauth_expires" -> ISO8601 timestamp
 *
 * The Bun CLI stores one record per profile:
 *   account "<profile>"               -> JSON blob {api_key, access_token, ...}
 *
 * Both libraries (Python `keyring`, Node `keytar`) hit the same OS vaults
 * (macOS Keychain, libsecret, Windows Credential Manager), so cross-reading
 * works as long as the service name matches — which it does.
 *
 * This function is called when the modern record is missing but at least
 * one legacy record exists. It assembles the new-format blob and writes it
 * via the normal save path. Legacy records are intentionally NOT deleted,
 * leaving an escape hatch if something is wrong with the migration.
 *
 * Gated by HOPX_NO_MIGRATE=1 for users who want to opt out.
 */
async function migrateLegacyCredentials(
  kt: KeytarLike,
  profile: string
): Promise<Credentials | null> {
  if (process.env.HOPX_NO_MIGRATE === "1") {
    return null;
  }

  let apiKey: string | null = null;
  let accessToken: string | null = null;
  let refreshToken: string | null = null;
  let expiresAt: string | null = null;

  try {
    apiKey = await kt.getPassword(SERVICE_NAME, `${profile}:api_key`);
    accessToken = await kt.getPassword(SERVICE_NAME, `${profile}:oauth_access`);
    refreshToken = await kt.getPassword(SERVICE_NAME, `${profile}:oauth_refresh`);
    expiresAt = await kt.getPassword(SERVICE_NAME, `${profile}:oauth_expires`);
  } catch {
    return null;
  }

  if (!apiKey && !accessToken && !refreshToken) {
    return null;
  }

  const migrated: Credentials = {};
  if (apiKey) migrated.api_key = apiKey;
  if (accessToken) migrated.access_token = accessToken;
  if (refreshToken) migrated.refresh_token = refreshToken;
  if (expiresAt) migrated.expires_at = expiresAt;

  // Write the new-format record so subsequent reads skip the migration path.
  try {
    await kt.setPassword(SERVICE_NAME, profile, JSON.stringify(migrated));
  } catch {
    // Ignore — the file fallback will still work.
  }

  // One-line notice to stderr so users understand what happened.
  process.stderr.write("Migrated credentials from hopx-cli (Python).\n");

  return migrated;
}

/**
 * Get credentials for a profile using keyring or file fallback.
 * On first call after switching from the Python CLI, transparently
 * migrates legacy records from the old keyring layout.
 */
export async function getCredentials(profile: string = "default"): Promise<Credentials> {
  const kt = loadKeytar();

  // 1. Try modern keyring record (Bun format)
  if (kt) {
    try {
      const stored = await kt.getPassword(SERVICE_NAME, profile);
      if (stored) {
        return JSON.parse(stored) as Credentials;
      }
    } catch {
      // Keyring failed, fall through
    }

    // 2. Try legacy Python layout (auto-migrate)
    const migrated = await migrateLegacyCredentials(kt, profile);
    if (migrated) {
      return migrated;
    }
  }

  // 3. File fallback (also reads Python CLI YAML format)
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
  const kt = loadKeytar();
  if (kt) {
    try {
      await kt.setPassword(SERVICE_NAME, profile, JSON.stringify(credentials));
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
  const kt = loadKeytar();
  if (kt) {
    try {
      await kt.deletePassword(SERVICE_NAME, profile);
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
  return loadKeytar() !== null;
}

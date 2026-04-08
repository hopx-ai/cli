/**
 * Configuration management for Hopx CLI
 * Handles loading/saving config from ~/.hopx/config.yaml
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import YAML from "yaml";

export interface ProfileConfig {
  api_key?: string;
  base_url?: string;
  default_template?: string;
  default_timeout?: number;
  output_format?: "table" | "json" | "plain";
}

export interface CLIConfig {
  default_profile: string;
  profiles: Record<string, ProfileConfig>;
}

const DEFAULT_CONFIG: CLIConfig = {
  default_profile: "default",
  profiles: {
    default: {
      base_url: "https://api.hopx.dev",
      default_template: "python",
      default_timeout: 300,
      output_format: "table",
    },
  },
};

/**
 * Get the Hopx configuration directory path
 */
export function getConfigDir(): string {
  return join(homedir(), ".hopx");
}

/**
 * Get the config file path
 */
export function getConfigPath(): string {
  return join(getConfigDir(), "config.yaml");
}

/**
 * Ensure the config directory exists with proper permissions
 */
export function ensureConfigDir(): void {
  const configDir = getConfigDir();
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true, mode: 0o700 });
  }
}

/**
 * Load configuration from file
 */
export function loadConfig(): CLIConfig {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const parsed = YAML.parse(content) as Partial<CLIConfig>;

    // Merge with defaults
    return {
      default_profile: parsed.default_profile ?? DEFAULT_CONFIG.default_profile,
      profiles: {
        ...DEFAULT_CONFIG.profiles,
        ...parsed.profiles,
      },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/**
 * Save configuration to file
 */
export function saveConfig(config: CLIConfig): void {
  ensureConfigDir();
  const configPath = getConfigPath();
  const content = YAML.stringify(config);
  writeFileSync(configPath, content, { mode: 0o600 });
}

/**
 * Get the current profile configuration
 */
export function getProfile(profileName?: string): ProfileConfig {
  const config = loadConfig();
  const name = profileName ?? process.env.HOPX_PROFILE ?? config.default_profile;
  return config.profiles[name] ?? config.profiles["default"] ?? {};
}

/**
 * Get API key from environment or config
 */
export function getApiKey(profileName?: string): string | undefined {
  // Environment variable takes precedence
  if (process.env.HOPX_API_KEY) {
    return process.env.HOPX_API_KEY;
  }

  const profile = getProfile(profileName);
  return profile.api_key;
}

/**
 * Get base URL from environment or config
 */
export function getBaseUrl(profileName?: string): string {
  if (process.env.HOPX_BASE_URL) {
    return process.env.HOPX_BASE_URL;
  }

  const profile = getProfile(profileName);
  return profile.base_url ?? "https://api.hopx.dev";
}

/**
 * Get output format from environment or config
 */
export function getOutputFormat(profileName?: string): "table" | "json" | "plain" {
  const cliOutput = process.env.HOPX_CLI_OUTPUT;
  if (cliOutput === "table" || cliOutput === "json" || cliOutput === "plain") {
    return cliOutput;
  }

  const profile = getProfile(profileName);
  return profile.output_format ?? "table";
}

/**
 * Get default template from config
 */
export function getDefaultTemplate(profileName?: string): string {
  if (process.env.HOPX_DEFAULT_TEMPLATE) {
    return process.env.HOPX_DEFAULT_TEMPLATE;
  }

  const profile = getProfile(profileName);
  return profile.default_template ?? "python";
}

/**
 * Get default timeout from config
 */
export function getDefaultTimeout(profileName?: string): number {
  if (process.env.HOPX_DEFAULT_TIMEOUT) {
    return parseInt(process.env.HOPX_DEFAULT_TIMEOUT, 10);
  }

  const profile = getProfile(profileName);
  return profile.default_timeout ?? 300;
}

/**
 * Set a configuration value for a profile
 */
export function setProfileValue(
  key: keyof ProfileConfig,
  value: string | number,
  profileName?: string
): void {
  const config = loadConfig();
  const name = profileName ?? config.default_profile;

  if (!config.profiles[name]) {
    config.profiles[name] = {};
  }

  // Type-safe assignment
  if (key === "api_key" || key === "base_url" || key === "default_template") {
    config.profiles[name][key] = String(value);
  } else if (key === "default_timeout") {
    config.profiles[name][key] = Number(value);
  } else if (key === "output_format") {
    const format = String(value);
    if (format === "table" || format === "json" || format === "plain") {
      config.profiles[name][key] = format;
    }
  }

  saveConfig(config);
}

/**
 * List all profile names
 */
export function listProfiles(): string[] {
  const config = loadConfig();
  return Object.keys(config.profiles);
}

/**
 * Create a new profile
 */
export function createProfile(name: string, values?: ProfileConfig): void {
  const config = loadConfig();
  config.profiles[name] = values ?? {};
  saveConfig(config);
}

/**
 * Delete a profile
 */
export function deleteProfile(name: string): boolean {
  if (name === "default") {
    return false; // Cannot delete default profile
  }

  const config = loadConfig();
  if (!config.profiles[name]) {
    return false;
  }

  delete config.profiles[name];

  // Reset default if deleted profile was default
  if (config.default_profile === name) {
    config.default_profile = "default";
  }

  saveConfig(config);
  return true;
}

/**
 * Set the default profile
 */
export function setDefaultProfile(name: string): boolean {
  const config = loadConfig();
  if (!config.profiles[name]) {
    return false;
  }

  config.default_profile = name;
  saveConfig(config);
  return true;
}

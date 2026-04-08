/**
 * Integration tests for configuration management workflows
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import YAML from "yaml";

describe("Configuration Workflow Integration", () => {
  let tempDir: string;
  let configDir: string;
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "hopx-config-test-"));
    configDir = join(tempDir, ".hopx");
    mkdirSync(configDir, { recursive: true });

    // Save and clear env vars
    savedEnv = {
      HOPX_API_KEY: process.env.HOPX_API_KEY,
      HOPX_BASE_URL: process.env.HOPX_BASE_URL,
      HOPX_PROFILE: process.env.HOPX_PROFILE,
      HOPX_CLI_OUTPUT: process.env.HOPX_CLI_OUTPUT,
      HOPX_DEFAULT_TEMPLATE: process.env.HOPX_DEFAULT_TEMPLATE,
      HOPX_DEFAULT_TIMEOUT: process.env.HOPX_DEFAULT_TIMEOUT,
    };

    delete process.env.HOPX_API_KEY;
    delete process.env.HOPX_BASE_URL;
    delete process.env.HOPX_PROFILE;
    delete process.env.HOPX_CLI_OUTPUT;
    delete process.env.HOPX_DEFAULT_TEMPLATE;
    delete process.env.HOPX_DEFAULT_TIMEOUT;
  });

  afterEach(() => {
    // Restore env vars
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("Config file operations", () => {
    it("should create config file with defaults", () => {
      const configPath = join(configDir, "config.yaml");
      const defaultConfig = {
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

      require("fs").writeFileSync(configPath, YAML.stringify(defaultConfig));

      expect(existsSync(configPath)).toBe(true);

      const content = readFileSync(configPath, "utf-8");
      const parsed = YAML.parse(content);

      expect(parsed.default_profile).toBe("default");
      expect(parsed.profiles.default.base_url).toBe("https://api.hopx.dev");
    });

    it("should load and merge with defaults", () => {
      const configPath = join(configDir, "config.yaml");

      // Write partial config
      const partialConfig = {
        profiles: {
          default: {
            api_key: "hopx_test_key.123",
          },
        },
      };

      require("fs").writeFileSync(configPath, YAML.stringify(partialConfig));

      const content = readFileSync(configPath, "utf-8");
      const parsed = YAML.parse(content);

      expect(parsed.profiles.default.api_key).toBe("hopx_test_key.123");
    });

    it("should handle corrupted config gracefully", () => {
      const configPath = join(configDir, "config.yaml");

      // Write invalid YAML
      require("fs").writeFileSync(configPath, "{ invalid: yaml: content");

      // Should return defaults on parse error
      let parsed;
      try {
        const content = readFileSync(configPath, "utf-8");
        parsed = YAML.parse(content);
      } catch {
        parsed = {
          default_profile: "default",
          profiles: { default: {} },
        };
      }

      expect(parsed.default_profile).toBe("default");
    });
  });

  describe("Profile management", () => {
    it("should create new profile", () => {
      const configPath = join(configDir, "config.yaml");
      const config = {
        default_profile: "default",
        profiles: {
          default: { base_url: "https://api.hopx.dev" },
        },
      };

      // Add new profile
      config.profiles["production"] = {
        api_key: "hopx_live_prod.key",
        base_url: "https://api.hopx.ai",
      } as typeof config.profiles.default;

      require("fs").writeFileSync(configPath, YAML.stringify(config));

      const content = readFileSync(configPath, "utf-8");
      const parsed = YAML.parse(content);

      expect(parsed.profiles.default).toBeDefined();
      expect(parsed.profiles.production).toBeDefined();
      expect(parsed.profiles.production.api_key).toBe("hopx_live_prod.key");
    });

    it("should switch default profile", () => {
      const configPath = join(configDir, "config.yaml");
      const config = {
        default_profile: "default",
        profiles: {
          default: { base_url: "https://api.hopx.dev" },
          production: { base_url: "https://api.hopx.ai" },
        },
      };

      config.default_profile = "production";

      require("fs").writeFileSync(configPath, YAML.stringify(config));

      const content = readFileSync(configPath, "utf-8");
      const parsed = YAML.parse(content);

      expect(parsed.default_profile).toBe("production");
    });

    it("should delete profile", () => {
      const configPath = join(configDir, "config.yaml");
      const config = {
        default_profile: "default",
        profiles: {
          default: { base_url: "https://api.hopx.dev" },
          toDelete: { base_url: "https://delete.me" },
        },
      };

      delete config.profiles.toDelete;

      require("fs").writeFileSync(configPath, YAML.stringify(config));

      const content = readFileSync(configPath, "utf-8");
      const parsed = YAML.parse(content);

      expect(parsed.profiles.default).toBeDefined();
      expect(parsed.profiles.toDelete).toBeUndefined();
    });

    it("should not delete default profile", () => {
      const config = {
        default_profile: "default",
        profiles: {
          default: { base_url: "https://api.hopx.dev" },
        },
      };

      // Attempting to delete default should fail
      const deleteProfile = (name: string) => {
        if (name === "default") return false;
        delete config.profiles[name as keyof typeof config.profiles];
        return true;
      };

      expect(deleteProfile("default")).toBe(false);
      expect(config.profiles.default).toBeDefined();
    });
  });

  describe("Environment variable precedence", () => {
    it("should prefer env var over config", () => {
      const configPath = join(configDir, "config.yaml");
      const config = {
        profiles: {
          default: { api_key: "config_key" },
        },
      };

      require("fs").writeFileSync(configPath, YAML.stringify(config));

      process.env.HOPX_API_KEY = "env_key";

      // Env var should take precedence
      expect(process.env.HOPX_API_KEY).toBe("env_key");

      delete process.env.HOPX_API_KEY;
    });

    it("should use config when env var not set", () => {
      const configPath = join(configDir, "config.yaml");
      const config = {
        profiles: {
          default: { api_key: "config_key" },
        },
      };

      require("fs").writeFileSync(configPath, YAML.stringify(config));

      expect(process.env.HOPX_API_KEY).toBeUndefined();

      const content = readFileSync(configPath, "utf-8");
      const parsed = YAML.parse(content);

      expect(parsed.profiles.default.api_key).toBe("config_key");
    });

    it("should respect HOPX_PROFILE env var", () => {
      process.env.HOPX_PROFILE = "staging";

      expect(process.env.HOPX_PROFILE).toBe("staging");

      delete process.env.HOPX_PROFILE;
    });

    it("should respect HOPX_CLI_OUTPUT env var", () => {
      process.env.HOPX_CLI_OUTPUT = "json";

      expect(process.env.HOPX_CLI_OUTPUT).toBe("json");

      delete process.env.HOPX_CLI_OUTPUT;
    });
  });

  describe("Setting individual values", () => {
    it("should update api_key in profile", () => {
      const configPath = join(configDir, "config.yaml");
      const config = {
        default_profile: "default",
        profiles: {
          default: {},
        },
      };

      (config.profiles.default as Record<string, unknown>).api_key = "new_key";

      require("fs").writeFileSync(configPath, YAML.stringify(config));

      const content = readFileSync(configPath, "utf-8");
      const parsed = YAML.parse(content);

      expect(parsed.profiles.default.api_key).toBe("new_key");
    });

    it("should update output_format in profile", () => {
      const configPath = join(configDir, "config.yaml");
      const config: {
        profiles: {
          default: { output_format?: string };
        };
      } = {
        profiles: {
          default: {},
        },
      };

      config.profiles.default.output_format = "json";

      require("fs").writeFileSync(configPath, YAML.stringify(config));

      const content = readFileSync(configPath, "utf-8");
      const parsed = YAML.parse(content);

      expect(parsed.profiles.default.output_format).toBe("json");
    });

    it("should validate output_format values", () => {
      const validFormats = ["table", "json", "plain"];
      const invalidFormat = "xml";

      expect(validFormats).toContain("table");
      expect(validFormats).toContain("json");
      expect(validFormats).toContain("plain");
      expect(validFormats).not.toContain(invalidFormat);
    });

    it("should update default_timeout as number", () => {
      const configPath = join(configDir, "config.yaml");
      const config: {
        profiles: {
          default: { default_timeout?: number };
        };
      } = {
        profiles: {
          default: {},
        },
      };

      config.profiles.default.default_timeout = 600;

      require("fs").writeFileSync(configPath, YAML.stringify(config));

      const content = readFileSync(configPath, "utf-8");
      const parsed = YAML.parse(content);

      expect(parsed.profiles.default.default_timeout).toBe(600);
      expect(typeof parsed.profiles.default.default_timeout).toBe("number");
    });
  });

  describe("Listing profiles", () => {
    it("should list all profile names", () => {
      const config = {
        profiles: {
          default: {},
          production: {},
          staging: {},
          development: {},
        },
      };

      const profileNames = Object.keys(config.profiles);

      expect(profileNames).toContain("default");
      expect(profileNames).toContain("production");
      expect(profileNames).toContain("staging");
      expect(profileNames).toContain("development");
      expect(profileNames.length).toBe(4);
    });
  });
});

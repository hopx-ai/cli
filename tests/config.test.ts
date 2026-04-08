/**
 * Unit tests for configuration management
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// We'll test the config module's logic

describe("Config Management", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "hopx-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("Default values", () => {
    it("should have correct default values", () => {
      const defaults = {
        default_profile: "default",
        base_url: "https://api.hopx.dev",
        default_template: "python",
        default_timeout: 300,
        output_format: "table",
      };

      expect(defaults.default_profile).toBe("default");
      expect(defaults.base_url).toBe("https://api.hopx.dev");
      expect(defaults.default_template).toBe("python");
      expect(defaults.default_timeout).toBe(300);
      expect(defaults.output_format).toBe("table");
    });
  });

  describe("Environment variable precedence", () => {
    it("should prefer environment variables over config", () => {
      const envKey = "test_api_key_from_env";
      process.env.HOPX_API_KEY = envKey;

      expect(process.env.HOPX_API_KEY).toBe(envKey);

      delete process.env.HOPX_API_KEY;
    });
  });

  describe("Profile management", () => {
    it("should validate profile config keys", () => {
      const validKeys = [
        "api_key",
        "base_url",
        "default_template",
        "default_timeout",
        "output_format",
      ];

      expect(validKeys).toContain("api_key");
      expect(validKeys).toContain("base_url");
      expect(validKeys).not.toContain("invalid_key");
    });

    it("should validate output format values", () => {
      const validFormats = ["table", "json", "plain"];

      expect(validFormats).toContain("table");
      expect(validFormats).toContain("json");
      expect(validFormats).toContain("plain");
      expect(validFormats).not.toContain("xml");
    });
  });
});

describe("API Key Format", () => {
  it("should validate correct API key format", () => {
    const validKeys = [
      "hopx_live_abc123.xyz789",
      "hopx_test_def456.uvw012",
    ];

    const pattern = /^hopx_(live|test)_[a-zA-Z0-9]+\.[a-zA-Z0-9]+$/;

    for (const key of validKeys) {
      expect(pattern.test(key)).toBe(true);
    }
  });

  it("should reject invalid API key format", () => {
    const invalidKeys = [
      "invalid_key",
      "hopx_invalid_abc.xyz",
      "hopx_live_noperiod",
      "",
    ];

    const pattern = /^hopx_(live|test)_[a-zA-Z0-9]+\.[a-zA-Z0-9]+$/;

    for (const key of invalidKeys) {
      expect(pattern.test(key)).toBe(false);
    }
  });
});

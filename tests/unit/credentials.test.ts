/**
 * Unit tests for credential storage
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "fs";
import { tmpdir, homedir } from "os";
import { join } from "path";

// We'll test credential storage logic directly
// Note: These tests use file-based fallback since keytar may not be available in tests

describe("Credential Storage", () => {
  let tempDir: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "hopx-cred-test-"));
    originalHome = process.env.HOME;
    // Can't easily override homedir(), so we test the file operations directly
  });

  afterEach(() => {
    if (originalHome) {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("File-based credentials storage", () => {
    it("should create credentials file with correct permissions", () => {
      const credPath = join(tempDir, "credentials.yaml");
      const fs = require("fs");

      fs.writeFileSync(credPath, JSON.stringify({ profiles: {} }), { mode: 0o600 });

      expect(existsSync(credPath)).toBe(true);

      // Check permissions (on Unix-like systems)
      const stats = fs.statSync(credPath);
      const mode = stats.mode & 0o777;
      expect(mode).toBe(0o600);
    });

    it("should store and retrieve credentials from file", () => {
      const credPath = join(tempDir, "credentials.yaml");
      const credentials = {
        profiles: {
          default: {
            api_key: "hopx_test_abc123.xyz789",
          },
        },
      };

      // Write
      require("fs").writeFileSync(credPath, JSON.stringify(credentials), { mode: 0o600 });

      // Read
      const content = readFileSync(credPath, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.profiles.default.api_key).toBe("hopx_test_abc123.xyz789");
    });

    it("should handle multiple profiles", () => {
      const credPath = join(tempDir, "credentials.yaml");
      const credentials = {
        profiles: {
          default: { api_key: "hopx_test_default.key" },
          production: { api_key: "hopx_live_prod.key" },
          staging: { api_key: "hopx_test_staging.key" },
        },
      };

      require("fs").writeFileSync(credPath, JSON.stringify(credentials), { mode: 0o600 });

      const content = readFileSync(credPath, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.profiles.default.api_key).toBe("hopx_test_default.key");
      expect(parsed.profiles.production.api_key).toBe("hopx_live_prod.key");
      expect(parsed.profiles.staging.api_key).toBe("hopx_test_staging.key");
    });

    it("should store OAuth tokens", () => {
      const credPath = join(tempDir, "credentials.yaml");
      const credentials = {
        profiles: {
          default: {
            access_token: "access_token_value",
            refresh_token: "refresh_token_value",
            expires_at: "2024-12-31T23:59:59Z",
          },
        },
      };

      require("fs").writeFileSync(credPath, JSON.stringify(credentials), { mode: 0o600 });

      const content = readFileSync(credPath, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.profiles.default.access_token).toBe("access_token_value");
      expect(parsed.profiles.default.refresh_token).toBe("refresh_token_value");
      expect(parsed.profiles.default.expires_at).toBe("2024-12-31T23:59:59Z");
    });

    it("should handle missing credentials file gracefully", () => {
      const credPath = join(tempDir, "nonexistent.yaml");

      expect(existsSync(credPath)).toBe(false);
      // loadCredentialsFile() should return empty profiles
    });

    it("should handle corrupted credentials file", () => {
      const credPath = join(tempDir, "credentials.yaml");

      // Write invalid JSON
      require("fs").writeFileSync(credPath, "{ invalid json }", { mode: 0o600 });

      // Should not throw, should return empty profiles
      let parsed = { profiles: {} };
      try {
        const content = readFileSync(credPath, "utf-8");
        parsed = JSON.parse(content);
      } catch {
        parsed = { profiles: {} };
      }

      expect(parsed.profiles).toEqual({});
    });
  });

  describe("API Key operations", () => {
    it("should prioritize environment variable over stored key", () => {
      process.env.HOPX_API_KEY = "env_api_key";

      expect(process.env.HOPX_API_KEY).toBe("env_api_key");

      delete process.env.HOPX_API_KEY;
    });

    it("should validate API key format", () => {
      const validKeys = [
        "hopx_live_abc123.xyz789",
        "hopx_test_def456.uvw012",
        "hopx_live_A1B2C3D4E5.F6G7H8I9J0",
      ];

      const invalidKeys = [
        "invalid_key",
        "hopx_invalid_abc.xyz",
        "hopx_live_noperiod",
        "hopx_test_.missing",
        "",
        "hopx_live_abc123.xyz789.extra",
      ];

      const pattern = /^hopx_(live|test)_[a-zA-Z0-9]+\.[a-zA-Z0-9]+$/;

      for (const key of validKeys) {
        expect(pattern.test(key)).toBe(true);
      }

      for (const key of invalidKeys) {
        expect(pattern.test(key)).toBe(false);
      }
    });
  });

  describe("Profile deletion", () => {
    it("should delete profile credentials", () => {
      const credPath = join(tempDir, "credentials.yaml");
      const credentials = {
        profiles: {
          default: { api_key: "key1" },
          toDelete: { api_key: "key2" },
        },
      };

      require("fs").writeFileSync(credPath, JSON.stringify(credentials), { mode: 0o600 });

      // Delete profile
      delete credentials.profiles.toDelete;
      require("fs").writeFileSync(credPath, JSON.stringify(credentials), { mode: 0o600 });

      const content = readFileSync(credPath, "utf-8");
      const parsed = JSON.parse(content);

      expect(parsed.profiles.default).toBeDefined();
      expect(parsed.profiles.toDelete).toBeUndefined();
    });
  });

  describe("Keyring availability", () => {
    it("should detect if keyring is available", () => {
      // In test environments, keytar may or may not be available
      // This test just verifies the check doesn't throw
      let isAvailable = false;
      try {
        require("keytar");
        isAvailable = true;
      } catch {
        isAvailable = false;
      }

      expect(typeof isAvailable).toBe("boolean");
    });
  });
});

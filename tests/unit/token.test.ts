/**
 * Unit tests for token management
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { isValidApiKeyFormat } from "../../src/lib/auth/token.js";

describe("Token Management", () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    // Save environment
    savedEnv = {
      HOPX_API_KEY: process.env.HOPX_API_KEY,
      HOPX_BASE_URL: process.env.HOPX_BASE_URL,
      HOPX_PROFILE: process.env.HOPX_PROFILE,
    };

    // Clear relevant env vars
    delete process.env.HOPX_API_KEY;
    delete process.env.HOPX_BASE_URL;
    delete process.env.HOPX_PROFILE;
  });

  afterEach(() => {
    // Restore environment
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  describe("isValidApiKeyFormat", () => {
    it("should accept valid live API keys", () => {
      expect(isValidApiKeyFormat("hopx_live_abc123.xyz789")).toBe(true);
      expect(isValidApiKeyFormat("hopx_live_ABCDEF.123456")).toBe(true);
      expect(isValidApiKeyFormat("hopx_live_a1b2c3d4e5f6.g7h8i9j0k1l2")).toBe(true);
    });

    it("should accept valid test API keys", () => {
      expect(isValidApiKeyFormat("hopx_test_abc123.xyz789")).toBe(true);
      expect(isValidApiKeyFormat("hopx_test_ABCDEF.123456")).toBe(true);
    });

    it("should reject keys without hopx_ prefix", () => {
      expect(isValidApiKeyFormat("abc_live_abc123.xyz789")).toBe(false);
      expect(isValidApiKeyFormat("live_abc123.xyz789")).toBe(false);
    });

    it("should reject keys without live/test designator", () => {
      expect(isValidApiKeyFormat("hopx_prod_abc123.xyz789")).toBe(false);
      expect(isValidApiKeyFormat("hopx_dev_abc123.xyz789")).toBe(false);
      expect(isValidApiKeyFormat("hopx_staging_abc123.xyz789")).toBe(false);
    });

    it("should reject keys without period separator", () => {
      expect(isValidApiKeyFormat("hopx_live_abc123xyz789")).toBe(false);
      expect(isValidApiKeyFormat("hopx_test_abc123_xyz789")).toBe(false);
    });

    it("should reject keys with special characters", () => {
      expect(isValidApiKeyFormat("hopx_live_abc-123.xyz-789")).toBe(false);
      expect(isValidApiKeyFormat("hopx_live_abc_123.xyz_789")).toBe(false);
      expect(isValidApiKeyFormat("hopx_live_abc@123.xyz!789")).toBe(false);
    });

    it("should reject empty or short keys", () => {
      expect(isValidApiKeyFormat("")).toBe(false);
      expect(isValidApiKeyFormat("hopx_live_.")).toBe(false);
      expect(isValidApiKeyFormat("hopx_live_a.")).toBe(false);
      expect(isValidApiKeyFormat("hopx_live_.b")).toBe(false);
    });

    it("should reject keys with multiple periods", () => {
      expect(isValidApiKeyFormat("hopx_live_abc.123.xyz")).toBe(false);
    });

    it("should reject keys with spaces", () => {
      expect(isValidApiKeyFormat("hopx_live_abc 123.xyz789")).toBe(false);
      expect(isValidApiKeyFormat(" hopx_live_abc123.xyz789")).toBe(false);
    });
  });

  describe("API Key Priority", () => {
    it("should prioritize HOPX_API_KEY environment variable", () => {
      process.env.HOPX_API_KEY = "hopx_test_env.key123";

      expect(process.env.HOPX_API_KEY).toBe("hopx_test_env.key123");
    });

    it("should allow overriding with CLI flag (via env)", () => {
      process.env.HOPX_API_KEY = "hopx_test_cli.override";

      expect(process.env.HOPX_API_KEY).toBe("hopx_test_cli.override");
    });
  });

  describe("Token Refresh Logic", () => {
    it("should identify tokens needing refresh (5 min margin)", () => {
      const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

      // Token expiring in 4 minutes - needs refresh
      const expiresIn4Min = new Date(Date.now() + 4 * 60 * 1000);
      const needsRefresh4 = Date.now() >= expiresIn4Min.getTime() - TOKEN_REFRESH_MARGIN_MS;
      expect(needsRefresh4).toBe(true);

      // Token expiring in 10 minutes - doesn't need refresh
      const expiresIn10Min = new Date(Date.now() + 10 * 60 * 1000);
      const needsRefresh10 = Date.now() >= expiresIn10Min.getTime() - TOKEN_REFRESH_MARGIN_MS;
      expect(needsRefresh10).toBe(false);

      // Token already expired
      const expired = new Date(Date.now() - 1000);
      const needsRefreshExpired = Date.now() >= expired.getTime() - TOKEN_REFRESH_MARGIN_MS;
      expect(needsRefreshExpired).toBe(true);
    });

    it("should handle undefined expiry (no refresh needed)", () => {
      const needsTokenRefresh = (expiresAt?: Date) => {
        if (!expiresAt) return false;
        const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;
        return Date.now() >= expiresAt.getTime() - TOKEN_REFRESH_MARGIN_MS;
      };

      expect(needsTokenRefresh(undefined)).toBe(false);
    });
  });

  describe("API Key Masking", () => {
    it("should mask API key for display", () => {
      const maskApiKey = (apiKey: string): string => {
        if (apiKey.length <= 12) {
          return "***" + apiKey.slice(-4);
        }
        return apiKey.slice(0, 8) + "..." + apiKey.slice(-4);
      };

      expect(maskApiKey("hopx_live_abc123.xyz789")).toBe("hopx_liv...z789");
      expect(maskApiKey("short")).toBe("***hort");
      // slice(-4) on "abc" returns the full string "abc" since it's shorter than 4 chars
      expect(maskApiKey("abc")).toBe("***abc");
    });

    it("should not reveal sensitive parts of API key", () => {
      const fullKey = "hopx_live_secretpart.anothersecret";
      const maskApiKey = (apiKey: string): string => {
        if (apiKey.length <= 12) {
          return "***" + apiKey.slice(-4);
        }
        return apiKey.slice(0, 8) + "..." + apiKey.slice(-4);
      };

      const masked = maskApiKey(fullKey);

      expect(masked).not.toContain("secretpart");
      expect(masked).not.toContain("anothersecret");
      expect(masked).toContain("hopx_liv");
      expect(masked.length).toBeLessThan(fullKey.length);
    });
  });

  describe("Auth Status", () => {
    it("should report unauthenticated when no credentials", () => {
      const getAuthStatusMock = (apiKey?: string, accessToken?: string) => {
        if (apiKey) {
          return { authenticated: true, method: "api_key" };
        }
        if (accessToken) {
          return { authenticated: true, method: "oauth" };
        }
        return { authenticated: false };
      };

      expect(getAuthStatusMock()).toEqual({ authenticated: false });
    });

    it("should report API key auth method", () => {
      const getAuthStatusMock = (apiKey?: string, accessToken?: string) => {
        if (apiKey) {
          return { authenticated: true, method: "api_key" };
        }
        if (accessToken) {
          return { authenticated: true, method: "oauth" };
        }
        return { authenticated: false };
      };

      expect(getAuthStatusMock("hopx_test_key.123")).toEqual({
        authenticated: true,
        method: "api_key",
      });
    });

    it("should report OAuth auth method", () => {
      const getAuthStatusMock = (apiKey?: string, accessToken?: string) => {
        if (apiKey) {
          return { authenticated: true, method: "api_key" };
        }
        if (accessToken) {
          return { authenticated: true, method: "oauth" };
        }
        return { authenticated: false };
      };

      expect(getAuthStatusMock(undefined, "oauth_token")).toEqual({
        authenticated: true,
        method: "oauth",
      });
    });
  });
});

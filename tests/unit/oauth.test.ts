/**
 * Regression tests for OAuth URL construction.
 *
 * Guards against the 0.2.0 bug where the Bun CLI built a bogus
 * `https://api.hopx.dev/auth/cli?callback=...` URL that 404'd, instead
 * of the real WorkOS authorize URL the Python CLI uses.
 */

import { describe, it, expect } from "bun:test";
import { buildWorkOSAuthUrl } from "../../src/lib/auth/oauth.js";

describe("OAuth URL construction", () => {
  const fixture = {
    clientId: "client_01K8REAP8X81GX10ZGTZKNRFMT",
    redirectUri: "http://127.0.0.1:39123/callback",
    provider: "GoogleOAuth" as const,
    state: "test-state-nonce",
  };

  it("targets WorkOS user_management/authorize, not api.hopx.dev", () => {
    const url = new URL(buildWorkOSAuthUrl(fixture));
    expect(url.origin).toBe("https://api.workos.com");
    expect(url.pathname).toBe("/user_management/authorize");
    // Regression guard: the broken 0.2.0 path must not reappear.
    expect(url.hostname).not.toBe("api.hopx.dev");
    expect(url.pathname).not.toBe("/auth/cli");
  });

  it("includes client_id, response_type, provider, state, and redirect_uri", () => {
    const url = new URL(buildWorkOSAuthUrl(fixture));
    expect(url.searchParams.get("client_id")).toBe(fixture.clientId);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("provider")).toBe(fixture.provider);
    expect(url.searchParams.get("state")).toBe(fixture.state);
    expect(url.searchParams.get("redirect_uri")).toBe(fixture.redirectUri);
  });

  it("url-encodes the redirect_uri so the colon and slashes survive", () => {
    const raw = buildWorkOSAuthUrl(fixture);
    // The raw query string must percent-encode the redirect URI.
    expect(raw).toContain("redirect_uri=http%3A%2F%2F127.0.0.1%3A39123%2Fcallback");
  });
});

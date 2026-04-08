/**
 * Unit tests for GET /auth/providers discovery.
 *
 * The terminal picker (pickProvider) is interactive and depends on
 * stdin/stdout, so it is not tested here — only the fetch logic is.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  fetchProviders,
  fetchProvidersWithFallback,
} from "../../src/lib/auth/providers.js";

type FetchLike = typeof globalThis.fetch;
const ORIGINAL_FETCH: FetchLike = globalThis.fetch;

function stubFetch(fn: FetchLike): void {
  globalThis.fetch = fn;
}

describe("fetchProviders", () => {
  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
  });

  it("returns the server's provider list and hits /auth/providers", async () => {
    let capturedUrl: string | undefined;
    stubFetch((async (url: string | URL | Request) => {
      capturedUrl = typeof url === "string" ? url : url.toString();
      return new Response(
        JSON.stringify({
          providers: [
            { id: "GoogleOAuth", name: "Google", icon: "google" },
            { id: "GitHubOAuth", name: "GitHub", icon: "github" },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }) as FetchLike);

    const providers = await fetchProviders("https://api.hopx.dev");
    expect(capturedUrl).toBe("https://api.hopx.dev/auth/providers");
    expect(providers).toEqual([
      { id: "GoogleOAuth", name: "Google", icon: "google" },
      { id: "GitHubOAuth", name: "GitHub", icon: "github" },
    ]);
  });

  it("throws on non-2xx responses", async () => {
    stubFetch((async () => new Response("boom", { status: 500 })) as FetchLike);

    await expect(fetchProviders("https://api.hopx.dev")).rejects.toThrow(/HTTP 500/);
  });

  it("throws when the provider list is empty", async () => {
    stubFetch((async () =>
      new Response(JSON.stringify({ providers: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as FetchLike);

    await expect(fetchProviders("https://api.hopx.dev")).rejects.toThrow("empty provider list");
  });

  it("throws when the payload is missing the providers field", async () => {
    stubFetch((async () =>
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as FetchLike);

    await expect(fetchProviders("https://api.hopx.dev")).rejects.toThrow();
  });
});

describe("fetchProvidersWithFallback", () => {
  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
  });

  it("reports fromServer=true on a successful fetch", async () => {
    stubFetch((async () =>
      new Response(
        JSON.stringify({
          providers: [{ id: "GoogleOAuth", name: "Google" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )) as FetchLike);

    const { providers, fromServer } = await fetchProvidersWithFallback("https://api.hopx.dev");
    expect(fromServer).toBe(true);
    expect(providers).toEqual([{ id: "GoogleOAuth", name: "Google" }]);
  });

  it("reports fromServer=false and returns the built-in list on network error", async () => {
    stubFetch((async () => {
      throw new Error("ECONNREFUSED");
    }) as FetchLike);

    const { providers, fromServer } = await fetchProvidersWithFallback("https://api.hopx.dev");
    expect(fromServer).toBe(false);
    // The built-in fallback must include at least the three providers
    // the Python CLI also whitelists, so users are never stuck with
    // no options if the server is briefly unreachable.
    const ids = providers.map((p) => p.id);
    expect(ids).toContain("GoogleOAuth");
    expect(ids).toContain("GitHubOAuth");
    expect(ids).toContain("MicrosoftOAuth");
  });

  it("reports fromServer=false on 500 response", async () => {
    stubFetch((async () => new Response("boom", { status: 500 })) as FetchLike);

    const { fromServer } = await fetchProvidersWithFallback("https://api.hopx.dev");
    expect(fromServer).toBe(false);
  });
});

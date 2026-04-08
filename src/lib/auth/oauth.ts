/**
 * OAuth browser-based authentication flow.
 *
 * Mirrors the Python hopx-cli flow (cli/src/hopx_cli/auth/oauth.py):
 *   1. Start a local HTTP server on the fixed port 39123 (pre-registered
 *      with WorkOS as the CLI redirect URI — must not be randomized).
 *   2. Open the browser to WorkOS `user_management/authorize` with the
 *      Hopx CLI's public WorkOS client ID and a CSRF `state` nonce.
 *   3. Handle the WorkOS redirect, verify `state`, extract the `code`.
 *   4. Exchange the code for tokens via POST to Hopx
 *      `/auth/workos-callback`, returning access/refresh/expires_at.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { URL } from "url";
import { randomBytes } from "crypto";
import open from "open";
import chalk from "chalk";
import { getBaseUrl } from "../config.js";

const OAUTH_TIMEOUT_MS = 120_000; // 2 minutes

// WorkOS OAuth client ID for the Hopx CLI. Public (sent to the browser).
// Must match what WorkOS has registered as the CLI application, including
// the http://127.0.0.1:39123/callback redirect URI.
const CLI_CLIENT_ID = "client_01K8REAP8X81GX10ZGTZKNRFMT";

// Fixed callback port registered with WorkOS. Do not randomize.
const OAUTH_CALLBACK_HOST = "127.0.0.1";
const OAUTH_CALLBACK_PORT = 39123;

// Allowed providers, matching Python's ALLOWED_PROVIDERS.
const ALLOWED_PROVIDERS = ["GoogleOAuth", "GitHubOAuth", "MicrosoftOAuth"] as const;
type Provider = (typeof ALLOWED_PROVIDERS)[number];
const DEFAULT_PROVIDER: Provider = "GoogleOAuth";

interface OAuthResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  apiKey?: string;
}

/**
 * Build the WorkOS authorize URL. Exported for unit testing.
 */
export function buildWorkOSAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  provider: Provider;
  state: string;
}): string {
  const qs = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    provider: params.provider,
    state: params.state,
  });
  return `https://api.workos.com/user_management/authorize?${qs.toString()}`;
}

/**
 * Exchange a WorkOS authorization code for Hopx access/refresh tokens.
 * Mirrors Python's exchange_code_for_token().
 */
async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<OAuthResult> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/auth/workos-callback`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, source: "cli", redirect_uri: redirectUri }),
    });
  } catch (err) {
    throw new Error(
      `Token exchange failed: could not reach ${url}: ${(err as Error).message}`
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Token exchange failed: HTTP ${response.status} ${response.statusText}${text ? ` — ${text}` : ""}`
    );
  }

  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
  };

  if (!data.access_token) {
    throw new Error("Token exchange failed: no access_token in response");
  }

  // Python's backend returns `expires_at` as a unix timestamp in seconds.
  const expiresAt =
    typeof data.expires_at === "number"
      ? new Date(data.expires_at * 1000)
      : undefined;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
  };
}

/**
 * Start the OAuth login flow. Opens the browser to WorkOS, waits for
 * the callback, and returns the exchanged tokens.
 */
export async function startOAuthLogin(
  provider: Provider = DEFAULT_PROVIDER
): Promise<OAuthResult> {
  if (!ALLOWED_PROVIDERS.includes(provider)) {
    throw new Error(
      `Invalid provider '${provider}'. Must be one of: ${ALLOWED_PROVIDERS.join(", ")}`
    );
  }

  const state = randomBytes(32).toString("base64url");
  const redirectUri = `http://${OAUTH_CALLBACK_HOST}:${OAUTH_CALLBACK_PORT}/callback`;

  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? "/", `http://${OAUTH_CALLBACK_HOST}`);

      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      // CSRF check
      const receivedState = url.searchParams.get("state");
      if (receivedState !== state) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(errorPage("Invalid state parameter (possible CSRF attack)"));
        cleanup();
        settle(() =>
          reject(new Error("OAuth error: invalid state parameter"))
        );
        return;
      }

      // OAuth error from provider
      const oauthError = url.searchParams.get("error");
      if (oauthError) {
        const desc = url.searchParams.get("error_description") ?? "";
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(errorPage(`${oauthError}${desc ? `: ${desc}` : ""}`));
        cleanup();
        settle(() =>
          reject(new Error(`OAuth error: ${oauthError}${desc ? ` - ${desc}` : ""}`))
        );
        return;
      }

      const code = url.searchParams.get("code");
      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(errorPage("No authorization code in callback"));
        cleanup();
        settle(() => reject(new Error("No authorization code received")));
        return;
      }

      // We have a code. Respond success to the browser immediately, then
      // exchange for tokens asynchronously.
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(successPage());
      cleanup();

      exchangeCodeForToken(code, redirectUri).then(
        (result) => settle(() => resolve(result)),
        (err) => settle(() => reject(err))
      );
    });

    const timeout = setTimeout(() => {
      cleanup();
      settle(() => reject(new Error("Authentication timed out after 2 minutes")));
    }, OAUTH_TIMEOUT_MS);

    const cleanup = () => {
      clearTimeout(timeout);
      server.close();
    };

    server.on("error", (err: NodeJS.ErrnoException) => {
      cleanup();
      if (err.code === "EADDRINUSE") {
        settle(() =>
          reject(
            new Error(
              `Cannot start OAuth callback server on port ${OAUTH_CALLBACK_PORT}. ` +
                `Port is in use — another 'hopx auth login' may be running.`
            )
          )
        );
        return;
      }
      settle(() => reject(err));
    });

    // Bind to the fixed port before opening the browser.
    server.listen(OAUTH_CALLBACK_PORT, OAUTH_CALLBACK_HOST, () => {
      const authUrl = buildWorkOSAuthUrl({
        clientId: CLI_CLIENT_ID,
        redirectUri,
        provider,
        state,
      });

      console.log(chalk.cyan("\nOpening browser for authentication..."));
      console.log(chalk.gray(`If browser doesn't open, visit: ${authUrl}\n`));

      open(authUrl).catch(() => {
        console.log(chalk.yellow("Could not open browser automatically."));
        console.log(chalk.yellow(`Please open this URL manually: ${authUrl}`));
      });
    });
  });
}

/**
 * HTML page shown on successful authentication
 */
function successPage(): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Hopx CLI - Authentication Successful</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      text-align: center;
      background: white;
      padding: 40px 60px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    h1 { color: #22c55e; margin-bottom: 10px; }
    p { color: #666; }
    .checkmark {
      font-size: 64px;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="checkmark">&#10003;</div>
    <h1>Authentication Successful</h1>
    <p>You can close this window and return to the terminal.</p>
  </div>
</body>
</html>
`;
}

/**
 * HTML page shown on authentication error
 */
function errorPage(error: string): string {
  // Basic HTML escape to prevent injection from provider-supplied strings.
  const safe = error
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Hopx CLI - Authentication Failed</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .container {
      text-align: center;
      background: white;
      padding: 40px 60px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    h1 { color: #ef4444; margin-bottom: 10px; }
    p { color: #666; }
    .error-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    .error-detail {
      background: #fef2f2;
      color: #dc2626;
      padding: 10px 20px;
      border-radius: 6px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon">&#10007;</div>
    <h1>Authentication Failed</h1>
    <p>Please try again or contact support.</p>
    <div class="error-detail">${safe}</div>
  </div>
</body>
</html>
`;
}

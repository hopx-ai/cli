/**
 * OAuth browser-based authentication flow
 * Opens browser for WorkOS authentication and captures callback
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { URL } from "url";
import open from "open";
import chalk from "chalk";
import { getBaseUrl } from "../config.js";

const OAUTH_TIMEOUT_MS = 120_000; // 2 minutes

interface OAuthResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  apiKey?: string;
}

/**
 * Start OAuth login flow
 * Opens browser and waits for callback with tokens
 */
export async function startOAuthLogin(): Promise<OAuthResult> {
  return new Promise((resolve, reject) => {
    // Create local server to receive callback
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? "/", `http://localhost`);

      if (url.pathname === "/callback") {
        // Extract tokens from query params
        const accessToken = url.searchParams.get("access_token");
        const refreshToken = url.searchParams.get("refresh_token");
        const expiresIn = url.searchParams.get("expires_in");
        const apiKey = url.searchParams.get("api_key");
        const error = url.searchParams.get("error");

        if (error) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(errorPage(error));
          cleanup();
          reject(new Error(`Authentication failed: ${error}`));
          return;
        }

        if (!accessToken && !apiKey) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(errorPage("No token received"));
          cleanup();
          reject(new Error("No authentication token received"));
          return;
        }

        // Calculate expiration
        const expiresAt = expiresIn
          ? new Date(Date.now() + parseInt(expiresIn, 10) * 1000)
          : undefined;

        // Send success page
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(successPage());

        cleanup();
        resolve({
          accessToken: accessToken ?? "",
          refreshToken: refreshToken ?? undefined,
          expiresAt,
          apiKey: apiKey ?? undefined,
        });
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    // Timeout handler
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Authentication timed out after 2 minutes"));
    }, OAUTH_TIMEOUT_MS);

    // Cleanup function
    const cleanup = () => {
      clearTimeout(timeout);
      server.close();
    };

    // Start server on random available port
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        cleanup();
        reject(new Error("Failed to start local server"));
        return;
      }

      const port = address.port;
      const callbackUrl = `http://127.0.0.1:${port}/callback`;
      const baseUrl = getBaseUrl();
      const authUrl = `${baseUrl}/auth/cli?callback=${encodeURIComponent(callbackUrl)}`;

      console.log(chalk.cyan("\nOpening browser for authentication..."));
      console.log(chalk.gray(`If browser doesn't open, visit: ${authUrl}\n`));

      // Open browser
      open(authUrl).catch(() => {
        console.log(chalk.yellow("Could not open browser automatically."));
        console.log(chalk.yellow(`Please open this URL manually: ${authUrl}`));
      });
    });

    server.on("error", (err) => {
      cleanup();
      reject(err);
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
    <div class="checkmark">✓</div>
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
    <div class="error-icon">✗</div>
    <h1>Authentication Failed</h1>
    <p>Please try again or contact support.</p>
    <div class="error-detail">${error}</div>
  </div>
</body>
</html>
`;
}

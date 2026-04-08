/**
 * Test helpers for Hopx CLI tests
 */

import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

/**
 * Create a temporary directory for tests
 */
export function createTempDir(prefix: string = "hopx-test-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

/**
 * Clean up a temporary directory
 */
export function cleanupTempDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

/**
 * Create a test context with temporary directories and cleanup
 */
export interface TestContext {
  tempDir: string;
  configDir: string;
  cleanup: () => void;
  savedEnv: Record<string, string | undefined>;
}

export function createTestContext(): TestContext {
  const tempDir = createTempDir();
  const configDir = join(tempDir, ".hopx");
  mkdirSync(configDir, { recursive: true });

  // Save original environment
  const savedEnv: Record<string, string | undefined> = {
    HOPX_API_KEY: process.env.HOPX_API_KEY,
    HOPX_BASE_URL: process.env.HOPX_BASE_URL,
    HOPX_PROFILE: process.env.HOPX_PROFILE,
    HOPX_CLI_OUTPUT: process.env.HOPX_CLI_OUTPUT,
    HOPX_DEFAULT_TEMPLATE: process.env.HOPX_DEFAULT_TEMPLATE,
    HOPX_DEFAULT_TIMEOUT: process.env.HOPX_DEFAULT_TIMEOUT,
    HOME: process.env.HOME,
  };

  // Clear relevant env vars for clean tests
  delete process.env.HOPX_API_KEY;
  delete process.env.HOPX_BASE_URL;
  delete process.env.HOPX_PROFILE;
  delete process.env.HOPX_CLI_OUTPUT;
  delete process.env.HOPX_DEFAULT_TEMPLATE;
  delete process.env.HOPX_DEFAULT_TIMEOUT;

  return {
    tempDir,
    configDir,
    savedEnv,
    cleanup: () => {
      // Restore environment
      for (const [key, value] of Object.entries(savedEnv)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
      cleanupTempDir(tempDir);
    },
  };
}

/**
 * Write a test config file
 */
export function writeTestConfig(configDir: string, config: Record<string, unknown>): void {
  const YAML = require("yaml");
  const configPath = join(configDir, "config.yaml");
  writeFileSync(configPath, YAML.stringify(config));
}

/**
 * Write test credentials file
 */
export function writeTestCredentials(
  configDir: string,
  credentials: Record<string, unknown>
): void {
  const credPath = join(configDir, "credentials.yaml");
  writeFileSync(credPath, JSON.stringify(credentials), { mode: 0o600 });
}

/**
 * Mock console output capture
 */
export class OutputCapture {
  private logs: string[] = [];
  private errors: string[] = [];
  private originalLog: typeof console.log;
  private originalError: typeof console.error;
  private originalWrite: typeof process.stdout.write;

  constructor() {
    this.originalLog = console.log;
    this.originalError = console.error;
    this.originalWrite = process.stdout.write.bind(process.stdout);
  }

  start(): void {
    console.log = (...args: unknown[]) => {
      this.logs.push(args.map(String).join(" "));
    };
    console.error = (...args: unknown[]) => {
      this.errors.push(args.map(String).join(" "));
    };
    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      this.logs.push(String(chunk));
      return true;
    };
  }

  stop(): void {
    console.log = this.originalLog;
    console.error = this.originalError;
    process.stdout.write = this.originalWrite;
  }

  getOutput(): string {
    return this.logs.join("\n");
  }

  getErrors(): string {
    return this.errors.join("\n");
  }

  clear(): void {
    this.logs = [];
    this.errors = [];
  }
}

/**
 * Create a mock fetch function for testing API calls
 */
export type MockResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

export function createMockFetch(
  responses: Map<string, MockResponse>
): typeof fetch {
  return async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();

    // Find matching response
    for (const [pattern, response] of responses) {
      if (url.includes(pattern)) {
        return response as unknown as Response;
      }
    }

    // Default 404 response
    return {
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({ error: "Not found" }),
      text: async () => "Not found",
    } as unknown as Response;
  };
}

/**
 * Create a successful mock response
 */
export function mockOk(data: unknown): MockResponse {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

/**
 * Create an error mock response
 */
export function mockError(status: number, message: string): MockResponse {
  return {
    ok: false,
    status,
    statusText: message,
    json: async () => ({ error: message }),
    text: async () => message,
  };
}

/**
 * Test API key constants
 */
export const TEST_API_KEY = "hopx_test_abc123def456.xyz789uvw012";
export const TEST_API_KEY_LIVE = "hopx_live_abc123def456.xyz789uvw012";
export const INVALID_API_KEY = "invalid_key_format";

/**
 * Wait for a condition with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs: number = 5000,
  intervalMs: number = 100
): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timeout waiting for condition after ${timeoutMs}ms`);
}

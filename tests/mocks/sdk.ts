/**
 * Mock SDK client for testing
 * Provides a mock implementation of @hopx-ai/sdk for isolated unit tests
 */

export interface MockSandboxOptions {
  template?: string;
  apiKey?: string;
  baseURL?: string;
  timeoutSeconds?: number;
  envVars?: Record<string, string>;
}

export interface MockRunCodeResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}

export interface MockFileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
}

export interface MockCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Mock Sandbox class that mimics @hopx-ai/sdk Sandbox
 */
export class MockSandbox {
  public sandboxId: string;
  public template: string;
  public status: "running" | "paused" | "stopped" = "running";
  public createdAt: Date;
  public files: Map<string, string> = new Map();
  public envVars: Map<string, string> = new Map();

  private static instances: Map<string, MockSandbox> = new Map();
  private static nextId = 1;

  constructor(options: MockSandboxOptions) {
    this.sandboxId = `sb_mock_${MockSandbox.nextId++}`;
    this.template = options.template ?? "python";
    this.createdAt = new Date();

    if (options.envVars) {
      for (const [key, value] of Object.entries(options.envVars)) {
        this.envVars.set(key, value);
      }
    }

    MockSandbox.instances.set(this.sandboxId, this);
  }

  /**
   * Create a new sandbox
   */
  static async create(options: MockSandboxOptions): Promise<MockSandbox> {
    if (!options.apiKey) {
      throw new MockAuthenticationError("API key is required");
    }
    return new MockSandbox(options);
  }

  /**
   * Connect to an existing sandbox
   */
  static async connect(sandboxId: string, options: { apiKey: string }): Promise<MockSandbox> {
    if (!options.apiKey) {
      throw new MockAuthenticationError("API key is required");
    }

    const sandbox = MockSandbox.instances.get(sandboxId);
    if (!sandbox) {
      throw new MockNotFoundError(`Sandbox not found: ${sandboxId}`);
    }
    return sandbox;
  }

  /**
   * Run code in the sandbox
   */
  async runCode(
    code: string,
    options?: { language?: string; timeout?: number }
  ): Promise<MockRunCodeResult> {
    if (this.status !== "running") {
      throw new MockValidationError("Sandbox is not running");
    }

    const language = options?.language ?? "python";

    // Simulate code execution
    let stdout = "";
    let stderr = "";
    let exitCode = 0;

    if (language === "python") {
      // Simple print detection
      const printMatch = code.match(/print\(['"](.+)['"]\)/);
      if (printMatch) {
        stdout = printMatch[1] + "\n";
      }
    } else if (language === "javascript" || language === "node") {
      const logMatch = code.match(/console\.log\(['"](.+)['"]\)/);
      if (logMatch) {
        stdout = logMatch[1] + "\n";
      }
    } else if (language === "bash") {
      if (code.includes("echo ")) {
        const echoMatch = code.match(/echo ['"]?(.+?)['"]?$/);
        if (echoMatch) {
          stdout = echoMatch[1] + "\n";
        }
      }
    }

    return {
      stdout,
      stderr,
      exitCode,
      executionTime: 50,
    };
  }

  /**
   * Execute a command in the sandbox
   */
  async runCommand(
    command: string,
    _options?: { timeout?: number; cwd?: string }
  ): Promise<MockCommandResult> {
    if (this.status !== "running") {
      throw new MockValidationError("Sandbox is not running");
    }

    return {
      stdout: `Executed: ${command}\n`,
      stderr: "",
      exitCode: 0,
    };
  }

  /**
   * File operations
   */
  get filesystem() {
    return {
      read: async (path: string): Promise<string> => {
        const content = this.files.get(path);
        if (content === undefined) {
          throw new MockNotFoundError(`File not found: ${path}`);
        }
        return content;
      },

      write: async (path: string, content: string): Promise<void> => {
        this.files.set(path, content);
      },

      list: async (path: string): Promise<MockFileInfo[]> => {
        const files: MockFileInfo[] = [];
        for (const [filePath] of this.files) {
          if (filePath.startsWith(path)) {
            const name = filePath.replace(path, "").replace(/^\//, "");
            if (name && !name.includes("/")) {
              files.push({
                name,
                path: filePath,
                isDirectory: false,
                size: this.files.get(filePath)?.length ?? 0,
                modifiedAt: new Date().toISOString(),
              });
            }
          }
        }
        return files;
      },

      delete: async (path: string): Promise<void> => {
        if (!this.files.has(path)) {
          throw new MockNotFoundError(`File not found: ${path}`);
        }
        this.files.delete(path);
      },

      upload: async (localPath: string, remotePath: string): Promise<void> => {
        // In tests, we just note the upload happened
        this.files.set(remotePath, `[uploaded from ${localPath}]`);
      },

      download: async (remotePath: string, _localPath: string): Promise<void> => {
        if (!this.files.has(remotePath)) {
          throw new MockNotFoundError(`File not found: ${remotePath}`);
        }
        // In tests, we just verify the file exists
      },
    };
  }

  /**
   * Kill the sandbox
   */
  async kill(): Promise<void> {
    this.status = "stopped";
    MockSandbox.instances.delete(this.sandboxId);
  }

  /**
   * Pause the sandbox
   */
  async pause(): Promise<void> {
    if (this.status !== "running") {
      throw new MockValidationError("Sandbox is not running");
    }
    this.status = "paused";
  }

  /**
   * Resume the sandbox
   */
  async resume(): Promise<void> {
    if (this.status !== "paused") {
      throw new MockValidationError("Sandbox is not paused");
    }
    this.status = "running";
  }

  /**
   * Clear all mock instances (for test cleanup)
   */
  static clearAll(): void {
    MockSandbox.instances.clear();
    MockSandbox.nextId = 1;
  }

  /**
   * Get all mock instances
   */
  static getAll(): MockSandbox[] {
    return Array.from(MockSandbox.instances.values());
  }
}

/**
 * Mock SDK Errors
 */
export class MockHopxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HopxError";
  }
}

export class MockAuthenticationError extends MockHopxError {
  constructor(message: string = "Authentication failed") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class MockNotFoundError extends MockHopxError {
  constructor(message: string = "Resource not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class MockValidationError extends MockHopxError {
  constructor(message: string = "Validation failed") {
    super(message);
    this.name = "ValidationError";
  }
}

export class MockNetworkError extends MockHopxError {
  constructor(message: string = "Network error") {
    super(message);
    this.name = "NetworkError";
  }
}

export class MockTimeoutError extends MockHopxError {
  constructor(message: string = "Operation timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

export class MockRateLimitError extends MockHopxError {
  constructor(message: string = "Rate limit exceeded") {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Replace the real SDK with mocks
 */
export function mockSdk(): void {
  // This would be used with jest.mock() or similar
  // For bun:test, we'd import the mock directly
}

/**
 * Restore the real SDK
 */
export function restoreSdk(): void {
  MockSandbox.clearAll();
}

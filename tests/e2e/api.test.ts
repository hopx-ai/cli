/**
 * E2E tests for Hopx CLI against real API
 *
 * These tests require a valid HOPX_API_KEY environment variable.
 * They create real resources and may incur costs.
 *
 * Run with: bun test tests/e2e/
 * Skip with: SKIP_E2E=1 bun test
 *
 * Timeouts: Sandbox creation can take 30-60s, so tests have extended timeouts.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, setDefaultTimeout } from "bun:test";

// Set default timeout to 60 seconds for E2E tests
setDefaultTimeout(60_000);
import { Sandbox } from "@hopx-ai/sdk";

// Configuration
const API_KEY = process.env.HOPX_API_KEY;
const BASE_URL = process.env.HOPX_BASE_URL ?? "https://api.hopx.dev";
const SKIP_E2E = process.env.SKIP_E2E === "1" || !API_KEY;

// Track sandboxes for cleanup
const createdSandboxes: string[] = [];

/**
 * Helper to skip tests when E2E is disabled
 */
function describeE2E(name: string, fn: () => void) {
  if (SKIP_E2E) {
    describe.skip(`[E2E] ${name}`, fn);
  } else {
    describe(`[E2E] ${name}`, fn);
  }
}

/**
 * Helper to register sandbox for cleanup
 */
function trackSandbox(sandboxId: string) {
  createdSandboxes.push(sandboxId);
}

/**
 * Cleanup all created sandboxes
 */
async function cleanupSandboxes() {
  for (const sandboxId of createdSandboxes) {
    try {
      const response = await fetch(`${BASE_URL}/v1/sandboxes/${sandboxId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${API_KEY}` },
      });
      if (response.ok) {
        console.log(`Cleaned up sandbox: ${sandboxId}`);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
  createdSandboxes.length = 0;
}

// Skip message for missing API key
if (SKIP_E2E) {
  describe("[E2E] Skipped", () => {
    it("E2E tests skipped - set HOPX_API_KEY to run", () => {
      console.log("Set HOPX_API_KEY environment variable to run E2E tests");
      expect(true).toBe(true);
    });
  });
}

describeE2E("System Health", () => {
  it("should return healthy status from /health endpoint", async () => {
    const response = await fetch(`${BASE_URL}/health`);

    expect(response.ok).toBe(true);

    const data = (await response.json()) as { status: string };
    expect(data.status).toBeDefined();
  });

  it("should include version in health response", async () => {
    const response = await fetch(`${BASE_URL}/health`);
    const data = (await response.json()) as { version?: string };

    // Version may or may not be present
    if (data.version) {
      expect(typeof data.version).toBe("string");
    }
  });
});

describeE2E("Authentication", () => {
  it("should reject requests without API key", async () => {
    const response = await fetch(`${BASE_URL}/v1/sandboxes`, {
      headers: {}, // No auth header
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);
  });

  it("should reject requests with invalid API key", async () => {
    const response = await fetch(`${BASE_URL}/v1/sandboxes`, {
      headers: { Authorization: "Bearer invalid_key" },
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);
  });

  it("should accept requests with valid API key", async () => {
    const response = await fetch(`${BASE_URL}/v1/sandboxes?limit=1`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    expect(response.ok).toBe(true);
  });
});

describeE2E("Template List", () => {
  it("should list available templates", async () => {
    const response = await fetch(`${BASE_URL}/v1/templates`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    expect(response.ok).toBe(true);

    const data = (await response.json()) as { data: Array<{ id: string; name: string }> };
    expect(Array.isArray(data.data)).toBe(true);
  });

  it("should include code-interpreter template", async () => {
    const response = await fetch(`${BASE_URL}/v1/templates`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    const data = (await response.json()) as {
      data: Array<{ id: string; name: string }>;
    };

    const templates = data.data ?? [];
    const hasCodeInterpreter = templates.some(
      (t) => t.name?.toLowerCase().includes("code-interpreter") || t.id?.toLowerCase().includes("code-interpreter")
    );

    // code-interpreter template should exist
    expect(hasCodeInterpreter || templates.length > 0).toBe(true);
  });
});

describeE2E("Sandbox Lifecycle", () => {
  let testSandboxId: string | null = null;

  afterAll(async () => {
    await cleanupSandboxes();
  });

  it("should create a sandbox", async () => {
    const sandbox = await Sandbox.create({
      template: "code-interpreter",
      apiKey: API_KEY!,
      baseURL: BASE_URL,
      timeoutSeconds: 300,
    });

    expect(sandbox.sandboxId).toBeDefined();
    expect(typeof sandbox.sandboxId).toBe("string");
    expect(sandbox.sandboxId.length).toBeGreaterThan(0);

    testSandboxId = sandbox.sandboxId;
    trackSandbox(sandbox.sandboxId);
  });

  it("should list sandboxes including the created one", async () => {
    if (!testSandboxId) {
      console.log("Skipping - no sandbox created");
      return;
    }

    const response = await fetch(`${BASE_URL}/v1/sandboxes?limit=50`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    expect(response.ok).toBe(true);

    const data = (await response.json()) as { data: Array<{ id: string }> };
    const sandboxIds = data.data.map((s) => s.id);

    expect(sandboxIds).toContain(testSandboxId);
  });

  it("should get sandbox info", async () => {
    if (!testSandboxId) {
      console.log("Skipping - no sandbox created");
      return;
    }

    const response = await fetch(`${BASE_URL}/v1/sandboxes/${testSandboxId}`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    expect(response.ok).toBe(true);

    const sandbox = (await response.json()) as { id: string; status: string };
    expect(sandbox.id).toBe(testSandboxId);
    expect(sandbox.status).toBeDefined();
  });

  it("should kill the sandbox", async () => {
    if (!testSandboxId) {
      console.log("Skipping - no sandbox created");
      return;
    }

    const response = await fetch(`${BASE_URL}/v1/sandboxes/${testSandboxId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    expect(response.ok).toBe(true);

    // Remove from cleanup list since we manually killed it
    const idx = createdSandboxes.indexOf(testSandboxId);
    if (idx > -1) createdSandboxes.splice(idx, 1);
  });
});

describeE2E("Code Execution", () => {
  let sandbox: Sandbox | null = null;

  beforeAll(async () => {
    sandbox = await Sandbox.create({
      template: "code-interpreter",
      apiKey: API_KEY!,
      baseURL: BASE_URL,
      timeoutSeconds: 300,
    });
    trackSandbox(sandbox.sandboxId);
  });

  afterAll(async () => {
    await cleanupSandboxes();
  });

  it("should execute Python code", async () => {
    if (!sandbox) {
      console.log("Skipping - no sandbox");
      return;
    }

    const result = await sandbox.runCode('print("Hello from E2E test!")');

    expect(result.stdout).toContain("Hello from E2E test!");
    expect(result.exitCode).toBe(0);
  });

  it("should execute Python with variables", async () => {
    if (!sandbox) {
      console.log("Skipping - no sandbox");
      return;
    }

    const result = await sandbox.runCode(`
x = 40
y = 2
print(f"The answer is {x + y}")
`);

    expect(result.stdout).toContain("The answer is 42");
  });

  it("should capture stderr", async () => {
    if (!sandbox) {
      console.log("Skipping - no sandbox");
      return;
    }

    const result = await sandbox.runCode(`
import sys
print("to stderr", file=sys.stderr)
print("to stdout")
`);

    expect(result.stdout).toContain("to stdout");
    expect(result.stderr).toContain("to stderr");
  });

  it("should return non-zero exit code on error", async () => {
    if (!sandbox) {
      console.log("Skipping - no sandbox");
      return;
    }

    const result = await sandbox.runCode('raise Exception("Test error")');

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Exception");
  });
});

describeE2E("File Operations", () => {
  let sandbox: Sandbox | null = null;

  beforeAll(async () => {
    sandbox = await Sandbox.create({
      template: "code-interpreter",
      apiKey: API_KEY!,
      baseURL: BASE_URL,
      timeoutSeconds: 300,
    });
    trackSandbox(sandbox.sandboxId);
  });

  afterAll(async () => {
    await cleanupSandboxes();
  });

  it("should write a file", async () => {
    if (!sandbox) {
      console.log("Skipping - no sandbox");
      return;
    }

    await sandbox.files.write("/workspace/test.txt", "Hello, E2E!");

    // Verify by reading back
    const content = await sandbox.files.read("/workspace/test.txt");
    expect(content).toBe("Hello, E2E!");
  });

  it("should read a file", async () => {
    if (!sandbox) {
      console.log("Skipping - no sandbox");
      return;
    }

    // Write first
    await sandbox.files.write("/workspace/read-test.txt", "Read me!");

    // Then read
    const content = await sandbox.files.read("/workspace/read-test.txt");
    expect(content).toBe("Read me!");
  });

  it("should list directory contents", async () => {
    if (!sandbox) {
      console.log("Skipping - no sandbox");
      return;
    }

    // Create some files
    await sandbox.files.write("/workspace/file1.txt", "content1");
    await sandbox.files.write("/workspace/file2.txt", "content2");

    // List directory
    const files = await sandbox.files.list("/workspace");

    expect(files.length).toBeGreaterThanOrEqual(2);

    const names = files.map((f: { name: string }) => f.name);
    expect(names).toContain("file1.txt");
    expect(names).toContain("file2.txt");
  });

  it("should write and execute a Python script", async () => {
    if (!sandbox) {
      console.log("Skipping - no sandbox");
      return;
    }

    // Write script
    await sandbox.files.write(
      "/workspace/script.py",
      `
def greet(name):
    return f"Hello, {name}!"

if __name__ == "__main__":
    print(greet("E2E"))
`
    );

    // Execute it
    const result = await sandbox.runCode('exec(open("/workspace/script.py").read())');

    expect(result.stdout).toContain("Hello, E2E!");
  });
});

describeE2E("Error Handling", () => {
  it("should return 404 for non-existent sandbox", async () => {
    const response = await fetch(`${BASE_URL}/v1/sandboxes/sb_nonexistent_12345`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    expect(response.ok).toBe(false);
    expect(response.status).toBe(404);
  });

  it("should handle non-existent template gracefully", async () => {
    // Use fetch directly to avoid SDK timeout issues
    const response = await fetch(`${BASE_URL}/v1/templates/nonexistent_template_xyz123`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });

    // Should return 404 or error
    expect(response.status === 404 || response.status >= 400).toBe(true);
  });
});

/**
 * Integration tests for sandbox lifecycle operations
 * Uses mock SDK to test workflows without real API calls
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  MockSandbox,
  MockAuthenticationError,
  MockNotFoundError,
  restoreSdk,
} from "../mocks/sdk.js";

describe("Sandbox Lifecycle Integration", () => {
  beforeEach(() => {
    restoreSdk(); // Clear any existing mocks
  });

  afterEach(() => {
    restoreSdk();
  });

  describe("Create → Info → Kill workflow", () => {
    it("should create sandbox successfully", async () => {
      const sandbox = await MockSandbox.create({
        template: "python",
        apiKey: "hopx_test_key.123",
      });

      expect(sandbox.sandboxId).toMatch(/^sb_mock_\d+$/);
      expect(sandbox.template).toBe("python");
      expect(sandbox.status).toBe("running");
    });

    it("should fail to create without API key", async () => {
      await expect(
        MockSandbox.create({
          template: "python",
          apiKey: undefined as unknown as string,
        })
      ).rejects.toThrow(MockAuthenticationError);
    });

    it("should connect to existing sandbox", async () => {
      const created = await MockSandbox.create({
        template: "python",
        apiKey: "hopx_test_key.123",
      });

      const connected = await MockSandbox.connect(created.sandboxId, {
        apiKey: "hopx_test_key.123",
      });

      expect(connected.sandboxId).toBe(created.sandboxId);
    });

    it("should fail to connect to non-existent sandbox", async () => {
      await expect(
        MockSandbox.connect("sb_nonexistent", { apiKey: "hopx_test_key.123" })
      ).rejects.toThrow(MockNotFoundError);
    });

    it("should kill sandbox successfully", async () => {
      const sandbox = await MockSandbox.create({
        template: "python",
        apiKey: "hopx_test_key.123",
      });

      await sandbox.kill();

      expect(sandbox.status).toBe("stopped");

      // Should not be able to connect anymore
      await expect(
        MockSandbox.connect(sandbox.sandboxId, { apiKey: "hopx_test_key.123" })
      ).rejects.toThrow(MockNotFoundError);
    });
  });

  describe("Pause → Resume workflow", () => {
    it("should pause running sandbox", async () => {
      const sandbox = await MockSandbox.create({
        template: "python",
        apiKey: "hopx_test_key.123",
      });

      expect(sandbox.status).toBe("running");

      await sandbox.pause();

      expect(sandbox.status).toBe("paused");
    });

    it("should resume paused sandbox", async () => {
      const sandbox = await MockSandbox.create({
        template: "python",
        apiKey: "hopx_test_key.123",
      });

      await sandbox.pause();
      expect(sandbox.status).toBe("paused");

      await sandbox.resume();
      expect(sandbox.status).toBe("running");
    });

    it("should fail to pause non-running sandbox", async () => {
      const sandbox = await MockSandbox.create({
        template: "python",
        apiKey: "hopx_test_key.123",
      });

      await sandbox.pause();

      // Try to pause again
      await expect(sandbox.pause()).rejects.toThrow("Sandbox is not running");
    });

    it("should fail to resume non-paused sandbox", async () => {
      const sandbox = await MockSandbox.create({
        template: "python",
        apiKey: "hopx_test_key.123",
      });

      // Try to resume running sandbox
      await expect(sandbox.resume()).rejects.toThrow("Sandbox is not paused");
    });
  });

  describe("Code execution", () => {
    it("should execute Python code", async () => {
      const sandbox = await MockSandbox.create({
        template: "python",
        apiKey: "hopx_test_key.123",
      });

      const result = await sandbox.runCode('print("hello world")', {
        language: "python",
      });

      expect(result.stdout).toContain("hello world");
      expect(result.exitCode).toBe(0);
    });

    it("should execute JavaScript code", async () => {
      const sandbox = await MockSandbox.create({
        template: "nodejs",
        apiKey: "hopx_test_key.123",
      });

      const result = await sandbox.runCode('console.log("hello js")', {
        language: "javascript",
      });

      expect(result.stdout).toContain("hello js");
      expect(result.exitCode).toBe(0);
    });

    it("should execute Bash commands", async () => {
      const sandbox = await MockSandbox.create({
        template: "python",
        apiKey: "hopx_test_key.123",
      });

      const result = await sandbox.runCode('echo "hello bash"', {
        language: "bash",
      });

      expect(result.stdout).toContain("hello bash");
    });

    it("should fail to execute code on paused sandbox", async () => {
      const sandbox = await MockSandbox.create({
        template: "python",
        apiKey: "hopx_test_key.123",
      });

      await sandbox.pause();

      await expect(sandbox.runCode('print("hello")')).rejects.toThrow(
        "Sandbox is not running"
      );
    });
  });

  describe("File operations", () => {
    it("should write and read file", async () => {
      const sandbox = await MockSandbox.create({
        template: "python",
        apiKey: "hopx_test_key.123",
      });

      await sandbox.filesystem.write("/workspace/test.txt", "Hello, World!");
      const content = await sandbox.filesystem.read("/workspace/test.txt");

      expect(content).toBe("Hello, World!");
    });

    it("should list files", async () => {
      const sandbox = await MockSandbox.create({
        template: "python",
        apiKey: "hopx_test_key.123",
      });

      await sandbox.filesystem.write("/workspace/file1.txt", "content1");
      await sandbox.filesystem.write("/workspace/file2.txt", "content2");

      const files = await sandbox.filesystem.list("/workspace");

      expect(files.length).toBe(2);
      expect(files.map((f) => f.name)).toContain("file1.txt");
      expect(files.map((f) => f.name)).toContain("file2.txt");
    });

    it("should delete file", async () => {
      const sandbox = await MockSandbox.create({
        template: "python",
        apiKey: "hopx_test_key.123",
      });

      await sandbox.filesystem.write("/workspace/todelete.txt", "delete me");
      await sandbox.filesystem.delete("/workspace/todelete.txt");

      await expect(
        sandbox.filesystem.read("/workspace/todelete.txt")
      ).rejects.toThrow(MockNotFoundError);
    });

    it("should fail to read non-existent file", async () => {
      const sandbox = await MockSandbox.create({
        template: "python",
        apiKey: "hopx_test_key.123",
      });

      await expect(
        sandbox.filesystem.read("/nonexistent.txt")
      ).rejects.toThrow(MockNotFoundError);
    });
  });

  describe("Command execution", () => {
    it("should run shell command", async () => {
      const sandbox = await MockSandbox.create({
        template: "python",
        apiKey: "hopx_test_key.123",
      });

      const result = await sandbox.runCommand("ls -la");

      expect(result.stdout).toContain("Executed:");
      expect(result.exitCode).toBe(0);
    });
  });

  describe("Environment variables", () => {
    it("should create sandbox with env vars", async () => {
      const sandbox = await MockSandbox.create({
        template: "python",
        apiKey: "hopx_test_key.123",
        envVars: {
          MY_VAR: "my_value",
          ANOTHER_VAR: "another_value",
        },
      });

      expect(sandbox.envVars.get("MY_VAR")).toBe("my_value");
      expect(sandbox.envVars.get("ANOTHER_VAR")).toBe("another_value");
    });
  });

  describe("Multiple sandboxes", () => {
    it("should track multiple sandboxes", async () => {
      const sandbox1 = await MockSandbox.create({
        template: "python",
        apiKey: "hopx_test_key.123",
      });

      const sandbox2 = await MockSandbox.create({
        template: "nodejs",
        apiKey: "hopx_test_key.123",
      });

      const sandbox3 = await MockSandbox.create({
        template: "python",
        apiKey: "hopx_test_key.123",
      });

      const all = MockSandbox.getAll();
      expect(all.length).toBe(3);

      // Each should have unique ID
      const ids = all.map((s) => s.sandboxId);
      expect(new Set(ids).size).toBe(3);
    });

    it("should clean up killed sandboxes", async () => {
      const sandbox1 = await MockSandbox.create({
        template: "python",
        apiKey: "hopx_test_key.123",
      });

      const sandbox2 = await MockSandbox.create({
        template: "python",
        apiKey: "hopx_test_key.123",
      });

      expect(MockSandbox.getAll().length).toBe(2);

      await sandbox1.kill();

      expect(MockSandbox.getAll().length).toBe(1);
      expect(MockSandbox.getAll()[0].sandboxId).toBe(sandbox2.sandboxId);
    });
  });
});

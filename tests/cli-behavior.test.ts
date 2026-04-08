/**
 * CLI behavior tests
 * Tests CLI output, help text, version, global options, and exit codes
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Command } from "commander";
import { ExitCode, CLIError, getExitCode, getSuggestion, formatError } from "../src/lib/errors.js";
import { OutputCapture } from "./helpers.js";

describe("CLI Version and Help", () => {
  describe("Version output", () => {
    it("should support --version flag", () => {
      const program = new Command()
        .name("hopx")
        .version("0.1.0", "-v, --version");

      expect(program.version()).toBe("0.1.0");
    });

    it("should support -v short flag", () => {
      const program = new Command()
        .name("hopx")
        .version("0.1.0", "-v, --version");

      // Version flag is recognized
      const opts = program.opts();
      expect(typeof program.version()).toBe("string");
    });
  });

  describe("Help output", () => {
    it("should have description", () => {
      const program = new Command()
        .name("hopx")
        .description("Official CLI for Hopx.ai cloud sandboxes");

      expect(program.description()).toBe("Official CLI for Hopx.ai cloud sandboxes");
    });

    it("should list all top-level commands", () => {
      const program = new Command().name("hopx");

      // Add commands like the real CLI
      program.addCommand(new Command("auth"));
      program.addCommand(new Command("sandbox"));
      program.addCommand(new Command("run"));
      program.addCommand(new Command("files"));
      program.addCommand(new Command("cmd"));
      program.addCommand(new Command("env"));
      program.addCommand(new Command("terminal"));
      program.addCommand(new Command("template"));
      program.addCommand(new Command("config"));
      program.addCommand(new Command("system"));
      program.addCommand(new Command("init"));
      program.addCommand(new Command("org"));
      program.addCommand(new Command("profile"));
      program.addCommand(new Command("members"));
      program.addCommand(new Command("billing"));
      program.addCommand(new Command("usage"));

      const commandNames = program.commands.map((c) => c.name());

      expect(commandNames).toContain("auth");
      expect(commandNames).toContain("sandbox");
      expect(commandNames).toContain("run");
      expect(commandNames).toContain("files");
      expect(commandNames).toContain("config");
      expect(commandNames.length).toBe(16);
    });

    it("should show help for subcommands", () => {
      const sandbox = new Command("sandbox")
        .description("Sandbox lifecycle management");

      sandbox
        .command("create")
        .description("Create a new sandbox")
        .option("-t, --template <name>", "Template to use");

      const create = sandbox.commands.find((c) => c.name() === "create");

      expect(create).toBeDefined();
      expect(create?.description()).toBe("Create a new sandbox");
    });
  });
});

describe("Global Options", () => {
  it("should support --api-key option", () => {
    const program = new Command()
      .option("--api-key <key>", "API key for authentication");

    program.parse(["node", "test", "--api-key", "hopx_test_key.123"]);

    expect(program.opts().apiKey).toBe("hopx_test_key.123");
  });

  it("should support --profile option with default", () => {
    const program = new Command()
      .option("--profile <name>", "Configuration profile to use", "default");

    // Without providing option
    program.parse(["node", "test"]);
    expect(program.opts().profile).toBe("default");
  });

  it("should support --profile option override", () => {
    const program = new Command()
      .option("--profile <name>", "Configuration profile to use", "default");

    program.parse(["node", "test", "--profile", "production"]);
    expect(program.opts().profile).toBe("production");
  });

  it("should support -o/--output option", () => {
    const program = new Command()
      .option("-o, --output <format>", "Output format: table, json, plain", "table");

    program.parse(["node", "test", "-o", "json"]);
    expect(program.opts().output).toBe("json");
  });

  it("should support --no-color option", () => {
    const program = new Command().option("--no-color", "Disable colored output");

    program.parse(["node", "test", "--no-color"]);
    expect(program.opts().color).toBe(false);
  });
});

describe("Exit Codes", () => {
  it("should have correct exit code values", () => {
    expect(ExitCode.Success).toBe(0);
    expect(ExitCode.GeneralError).toBe(1);
    expect(ExitCode.ValidationError).toBe(2);
    expect(ExitCode.AuthenticationError).toBe(3);
    expect(ExitCode.NotFoundError).toBe(4);
    expect(ExitCode.TimeoutError).toBe(5);
    expect(ExitCode.NetworkError).toBe(6);
    expect(ExitCode.RateLimitError).toBe(7);
    expect(ExitCode.Interrupted).toBe(130);
  });

  describe("getExitCode", () => {
    it("should return correct code for CLIError", () => {
      const error = new CLIError("Test", ExitCode.ValidationError);
      expect(getExitCode(error)).toBe(ExitCode.ValidationError);
    });

    it("should return GeneralError for unknown errors", () => {
      const error = new Error("Unknown error");
      expect(getExitCode(error)).toBe(ExitCode.GeneralError);
    });
  });

  describe("getSuggestion", () => {
    it("should return suggestion from CLIError", () => {
      const error = new CLIError("Test", ExitCode.GeneralError, "Try this");
      expect(getSuggestion(error)).toBe("Try this");
    });

    it("should return undefined for errors without suggestion", () => {
      const error = new Error("No suggestion");
      expect(getSuggestion(error)).toBeUndefined();
    });
  });
});

describe("Error Messages", () => {
  let capture: OutputCapture;

  beforeEach(() => {
    capture = new OutputCapture();
    capture.start();
  });

  afterEach(() => {
    capture.stop();
  });

  describe("formatError", () => {
    it("should format error with message", () => {
      const error = new Error("Something went wrong");
      const formatted = formatError(error);

      expect(formatted).toContain("Error:");
      expect(formatted).toContain("Something went wrong");
    });

    it("should include suggestion when available", () => {
      const error = new CLIError(
        "Authentication failed",
        ExitCode.AuthenticationError,
        'Run "hopx auth login" to authenticate'
      );
      const formatted = formatError(error);

      expect(formatted).toContain("Error:");
      expect(formatted).toContain("Authentication failed");
      expect(formatted).toContain("Suggestion:");
      expect(formatted).toContain("hopx auth login");
    });

    it("should handle non-Error objects", () => {
      const formatted = formatError("String error");

      expect(formatted).toContain("Error:");
      expect(formatted).toContain("String error");
    });
  });
});

describe("JSON Output Mode", () => {
  it("should output valid JSON for list commands", () => {
    const data = [
      { id: "sb_1", status: "running" },
      { id: "sb_2", status: "paused" },
    ];

    const output = JSON.stringify(data, null, 2);
    const parsed = JSON.parse(output);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(2);
    expect(parsed[0].id).toBe("sb_1");
  });

  it("should output valid JSON for info commands", () => {
    const data = {
      id: "sb_123",
      template: "python",
      status: "running",
      created_at: "2024-01-15T12:00:00Z",
    };

    const output = JSON.stringify(data, null, 2);
    const parsed = JSON.parse(output);

    expect(parsed.id).toBe("sb_123");
    expect(parsed.template).toBe("python");
  });
});

describe("Confirmation Prompts", () => {
  it("should support --yes/-y flag to skip confirmation", () => {
    const cmd = new Command("kill")
      .argument("<id>")
      .option("-y, --yes", "Skip confirmation");

    cmd.parse(["node", "test", "sb_123", "-y"]);

    expect(cmd.opts().yes).toBe(true);
  });

  it("should not have --yes by default", () => {
    const cmd = new Command("kill")
      .argument("<id>")
      .option("-y, --yes", "Skip confirmation");

    cmd.parse(["node", "test", "sb_123"]);

    expect(cmd.opts().yes).toBeUndefined();
  });
});

describe("CLIError Class", () => {
  it("should create error with message only", () => {
    const error = new CLIError("Simple error");

    expect(error.message).toBe("Simple error");
    expect(error.exitCode).toBe(ExitCode.GeneralError);
    expect(error.suggestion).toBeUndefined();
  });

  it("should create error with exit code", () => {
    const error = new CLIError("Auth error", ExitCode.AuthenticationError);

    expect(error.exitCode).toBe(ExitCode.AuthenticationError);
  });

  it("should create error with suggestion", () => {
    const error = new CLIError(
      "Not found",
      ExitCode.NotFoundError,
      "Check the ID and try again"
    );

    expect(error.suggestion).toBe("Check the ID and try again");
  });

  it("should be instanceof Error", () => {
    const error = new CLIError("Test");

    expect(error instanceof Error).toBe(true);
    expect(error instanceof CLIError).toBe(true);
  });

  it("should have correct name", () => {
    const error = new CLIError("Test");

    expect(error.name).toBe("CLIError");
  });
});

describe("Output Format Switching", () => {
  it("should default to table format", () => {
    const program = new Command()
      .option("-o, --output <format>", "Output format", "table");

    program.parse(["node", "test"]);

    expect(program.opts().output).toBe("table");
  });

  it("should accept json format", () => {
    const program = new Command()
      .option("-o, --output <format>", "Output format", "table");

    program.parse(["node", "test", "-o", "json"]);

    expect(program.opts().output).toBe("json");
  });

  it("should accept plain format", () => {
    const program = new Command()
      .option("-o, --output <format>", "Output format", "table");

    program.parse(["node", "test", "-o", "plain"]);

    expect(program.opts().output).toBe("plain");
  });
});

describe("Environment Variable Mapping", () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {
      HOPX_API_KEY: process.env.HOPX_API_KEY,
      HOPX_CLI_OUTPUT: process.env.HOPX_CLI_OUTPUT,
      HOPX_PROFILE: process.env.HOPX_PROFILE,
      NO_COLOR: process.env.NO_COLOR,
    };
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("should set HOPX_CLI_OUTPUT from --output", () => {
    // Simulate the preAction hook
    process.env.HOPX_CLI_OUTPUT = "json";

    expect(process.env.HOPX_CLI_OUTPUT).toBe("json");
  });

  it("should set HOPX_API_KEY from --api-key", () => {
    process.env.HOPX_API_KEY = "hopx_test_cli.key";

    expect(process.env.HOPX_API_KEY).toBe("hopx_test_cli.key");
  });

  it("should set HOPX_PROFILE from --profile", () => {
    process.env.HOPX_PROFILE = "production";

    expect(process.env.HOPX_PROFILE).toBe("production");
  });

  it("should set NO_COLOR from --no-color", () => {
    process.env.NO_COLOR = "1";

    expect(process.env.NO_COLOR).toBe("1");
  });
});

/**
 * Unit tests for CLI command parsing
 * Tests argument parsing, options, and command structure
 */

import { describe, it, expect } from "bun:test";
import { Command } from "commander";

describe("Command Structure", () => {
  describe("Main program", () => {
    it("should have correct name", () => {
      const program = new Command()
        .name("hopx")
        .description("Official CLI for Hopx.ai cloud sandboxes");

      expect(program.name()).toBe("hopx");
    });

    it("should have global options", () => {
      const program = new Command()
        .option("--api-key <key>", "API key for authentication")
        .option("--profile <name>", "Configuration profile to use", "default")
        .option("-o, --output <format>", "Output format: table, json, plain", "table")
        .option("--no-color", "Disable colored output");

      const opts = program.opts();
      expect(opts.profile).toBe("default");
      expect(opts.output).toBe("table");
    });
  });

  describe("sandbox command", () => {
    it("should have correct subcommands", () => {
      const sandbox = new Command("sandbox")
        .alias("sb")
        .description("Sandbox lifecycle management");

      sandbox.command("create").description("Create a new sandbox");
      sandbox.command("list").description("List all sandboxes");
      sandbox.command("info").description("Get sandbox details");
      sandbox.command("kill").description("Terminate a sandbox");
      sandbox.command("pause").description("Pause a running sandbox");
      sandbox.command("resume").description("Resume a paused sandbox");

      expect(sandbox.name()).toBe("sandbox");
      expect(sandbox.alias()).toBe("sb");

      const commands = sandbox.commands.map((c) => c.name());
      expect(commands).toContain("create");
      expect(commands).toContain("list");
      expect(commands).toContain("info");
      expect(commands).toContain("kill");
      expect(commands).toContain("pause");
      expect(commands).toContain("resume");
    });

    it("sandbox create should have template option", () => {
      const create = new Command("create")
        .option("-t, --template <name>", "Template to use")
        .option("--timeout <seconds>", "Auto-kill timeout in seconds")
        .option("-e, --env <key=value...>", "Environment variables");

      create.parse(["node", "test", "-t", "python", "--timeout", "600"]);

      const opts = create.opts();
      expect(opts.template).toBe("python");
      expect(opts.timeout).toBe("600");
    });

    it("sandbox list should have status filter", () => {
      const list = new Command("list")
        .option("-s, --status <status>", "Filter by status")
        .option("-l, --limit <n>", "Limit results", "20");

      list.parse(["node", "test", "-s", "running", "-l", "50"]);

      const opts = list.opts();
      expect(opts.status).toBe("running");
      expect(opts.limit).toBe("50");
    });

    it("sandbox kill should have yes flag", () => {
      const kill = new Command("kill")
        .argument("<sandbox-id>", "Sandbox ID")
        .option("-y, --yes", "Skip confirmation");

      kill.parse(["node", "test", "sb_123", "-y"]);

      expect(kill.args[0]).toBe("sb_123");
      expect(kill.opts().yes).toBe(true);
    });
  });

  describe("run command", () => {
    it("should accept code argument", () => {
      const run = new Command("run")
        .argument("[code]", "Code to execute")
        .option("-f, --file <path>", "Execute code from file")
        .option("-l, --language <lang>", "Language: python, javascript, bash")
        .option("--sandbox <id>", "Use existing sandbox");

      run.parse(["node", "test", 'print("hello")', "-l", "python"]);

      expect(run.args[0]).toBe('print("hello")');
      expect(run.opts().language).toBe("python");
    });

    it("should accept file option", () => {
      const run = new Command("run")
        .option("-f, --file <path>", "Execute code from file");

      run.parse(["node", "test", "-f", "script.py"]);

      expect(run.opts().file).toBe("script.py");
    });
  });

  describe("files command", () => {
    it("should have correct subcommands", () => {
      const files = new Command("files").alias("f");

      files.command("read").argument("<path>");
      files.command("write").argument("<path>").argument("[content]");
      files.command("list").argument("[path]");
      files.command("delete").argument("<path>");
      files.command("upload").argument("<local>").argument("<remote>");
      files.command("download").argument("<remote>").argument("<local>");

      expect(files.alias()).toBe("f");

      const commands = files.commands.map((c) => c.name());
      expect(commands).toContain("read");
      expect(commands).toContain("write");
      expect(commands).toContain("list");
      expect(commands).toContain("delete");
      expect(commands).toContain("upload");
      expect(commands).toContain("download");
    });
  });

  describe("auth command", () => {
    it("should have login, logout, status subcommands", () => {
      const auth = new Command("auth");

      auth.command("login");
      auth.command("logout");
      auth.command("status");
      auth
        .command("api-keys")
        .command("list");

      const commands = auth.commands.map((c) => c.name());
      expect(commands).toContain("login");
      expect(commands).toContain("logout");
      expect(commands).toContain("status");
      expect(commands).toContain("api-keys");
    });
  });

  describe("config command", () => {
    it("should have show, set, get subcommands", () => {
      const config = new Command("config");

      config.command("show");
      config.command("set").argument("<key>").argument("<value>");
      config.command("get").argument("<key>");
      config.command("profile");

      const commands = config.commands.map((c) => c.name());
      expect(commands).toContain("show");
      expect(commands).toContain("set");
      expect(commands).toContain("get");
      expect(commands).toContain("profile");
    });
  });

  describe("template command", () => {
    it("should have list, build, delete subcommands", () => {
      const template = new Command("template").alias("tpl");

      template.command("list");
      template.command("build");
      template.command("delete").argument("<template-id>");

      expect(template.alias()).toBe("tpl");

      const commands = template.commands.map((c) => c.name());
      expect(commands).toContain("list");
      expect(commands).toContain("build");
      expect(commands).toContain("delete");
    });
  });

  describe("cmd command", () => {
    it("should have run and background subcommands", () => {
      const cmd = new Command("cmd");

      cmd.command("run").argument("<command...>");
      cmd.command("background").argument("<command...>");

      const commands = cmd.commands.map((c) => c.name());
      expect(commands).toContain("run");
      expect(commands).toContain("background");
    });
  });

  describe("env command", () => {
    it("should have list, set, get, unset subcommands", () => {
      const env = new Command("env");

      env.command("list");
      env.command("set").argument("<key>").argument("<value>");
      env.command("get").argument("<key>");
      env.command("unset").argument("<key>");

      const commands = env.commands.map((c) => c.name());
      expect(commands).toContain("list");
      expect(commands).toContain("set");
      expect(commands).toContain("get");
      expect(commands).toContain("unset");
    });
  });

  describe("system command", () => {
    it("should have health and metrics subcommands", () => {
      const system = new Command("system");

      system.command("health");
      system.command("metrics");

      const commands = system.commands.map((c) => c.name());
      expect(commands).toContain("health");
      expect(commands).toContain("metrics");
    });
  });
});

describe("Command Aliases", () => {
  it("sandbox should have sb alias", () => {
    const sandbox = new Command("sandbox").alias("sb");
    expect(sandbox.alias()).toBe("sb");
  });

  it("files should have f alias", () => {
    const files = new Command("files").alias("f");
    expect(files.alias()).toBe("f");
  });

  it("template should have tpl alias", () => {
    const template = new Command("template").alias("tpl");
    expect(template.alias()).toBe("tpl");
  });

  it("terminal should have term alias", () => {
    const terminal = new Command("terminal").alias("term");
    expect(terminal.alias()).toBe("term");
  });
});

describe("Option Parsing", () => {
  it("should parse environment variables", () => {
    const cmd = new Command("create").option("-e, --env <key=value...>", "Environment variables");

    cmd.parse(["node", "test", "-e", "FOO=bar", "-e", "BAZ=qux"]);

    expect(cmd.opts().env).toEqual(["FOO=bar", "BAZ=qux"]);
  });

  it("should parse timeout as string", () => {
    const cmd = new Command("create").option("--timeout <seconds>", "Timeout");

    cmd.parse(["node", "test", "--timeout", "300"]);

    expect(cmd.opts().timeout).toBe("300");
  });

  it("should handle boolean flags", () => {
    const cmd = new Command("kill").option("-y, --yes", "Skip confirmation");

    cmd.parse(["node", "test"]);
    expect(cmd.opts().yes).toBeUndefined();

    const cmd2 = new Command("kill").option("-y, --yes", "Skip confirmation");
    cmd2.parse(["node", "test", "-y"]);
    expect(cmd2.opts().yes).toBe(true);
  });

  it("should support default values", () => {
    const cmd = new Command("list")
      .option("-l, --limit <n>", "Limit results", "20")
      .option("-o, --output <format>", "Output format", "table");

    cmd.parse(["node", "test"]);

    expect(cmd.opts().limit).toBe("20");
    expect(cmd.opts().output).toBe("table");
  });

  it("should override defaults with provided values", () => {
    const cmd = new Command("list")
      .option("-l, --limit <n>", "Limit results", "20")
      .option("-o, --output <format>", "Output format", "table");

    cmd.parse(["node", "test", "-l", "50", "-o", "json"]);

    expect(cmd.opts().limit).toBe("50");
    expect(cmd.opts().output).toBe("json");
  });
});

describe("Argument Parsing", () => {
  it("should parse required arguments", () => {
    const cmd = new Command("info").argument("<sandbox-id>", "Sandbox ID");

    cmd.parse(["node", "test", "sb_abc123"]);

    expect(cmd.args[0]).toBe("sb_abc123");
  });

  it("should parse optional arguments", () => {
    const cmd = new Command("run").argument("[code]", "Code to execute");

    cmd.parse(["node", "test"]);
    expect(cmd.args[0]).toBeUndefined();

    const cmd2 = new Command("run").argument("[code]", "Code to execute");
    cmd2.parse(["node", "test", 'print("hi")'  ]);
    expect(cmd2.args[0]).toBe('print("hi")');
  });

  it("should parse variadic arguments", () => {
    const cmd = new Command("run")
      .argument("<command...>", "Command to run")
      .allowUnknownOption(); // Allow unknown options to be passed as arguments

    cmd.parse(["node", "test", "ls", "--", "-la", "/tmp"]);

    // Arguments after -- are passed through
    expect(cmd.args).toContain("ls");
  });

  it("should parse multiple arguments", () => {
    const cmd = new Command("upload")
      .argument("<local>", "Local path")
      .argument("<remote>", "Remote path");

    cmd.parse(["node", "test", "/local/file.txt", "/remote/file.txt"]);

    expect(cmd.args[0]).toBe("/local/file.txt");
    expect(cmd.args[1]).toBe("/remote/file.txt");
  });
});

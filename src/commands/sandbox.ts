/**
 * sandbox command - Sandbox lifecycle management
 */

import { Command } from "commander";
import chalk from "chalk";
import { createInterface } from "readline";
import { Sandbox } from "@hopx-ai/sdk";
import { requireApiKey } from "../lib/auth/token.js";
import { getDefaultTemplate, getDefaultTimeout, getBaseUrl } from "../lib/config.js";
import { withErrorHandler, CLIError, ExitCode } from "../lib/errors.js";
import { success, info, withSpinner } from "../lib/output/progress.js";
import { output, outputList } from "../lib/output/index.js";
import { statusFormat, relativeDate } from "../lib/output/table.js";

export const sandboxCommand = new Command("sandbox")
  .alias("sb")
  .description("Sandbox lifecycle management");

// sandbox create
sandboxCommand
  .command("create")
  .description("Create a new sandbox")
  .option("-t, --template <name>", "Template to use")
  .option("--timeout <seconds>", "Auto-kill timeout in seconds")
  .option("-e, --env <key=value...>", "Environment variables")
  .action(
    withErrorHandler(async (options: { template?: string; timeout?: string; env?: string[] }) => {
      const apiKey = await requireApiKey();
      const template = options.template ?? getDefaultTemplate();
      const timeout = options.timeout ? parseInt(options.timeout, 10) : getDefaultTimeout();

      // Parse environment variables
      const envVars: Record<string, string> = {};
      if (options.env) {
        for (const item of options.env) {
          const [key, ...valueParts] = item.split("=");
          if (key) {
            envVars[key] = valueParts.join("=");
          }
        }
      }

      const sandbox = await withSpinner(
        `Creating sandbox with template: ${template}`,
        () =>
          Sandbox.create({
            template,
            apiKey,
            baseURL: getBaseUrl(),
            timeoutSeconds: timeout,
            envVars: Object.keys(envVars).length > 0 ? envVars : undefined,
          }),
        { successMessage: "Sandbox created!" }
      );

      output(
        {
          sandbox_id: sandbox.sandboxId,
          template,
          status: "running",
          timeout: `${timeout}s`,
        },
        { keyValueTitle: "Sandbox Created" }
      );

      console.log(chalk.gray(`\nQuick start:`));
      console.log(chalk.gray(`  hopx run 'print("hello")' --sandbox ${sandbox.sandboxId}`));
    })
  );

// sandbox list
sandboxCommand
  .command("list")
  .description("List all sandboxes")
  .option("-s, --status <status>", "Filter by status")
  .option("-l, --limit <n>", "Limit results", "20")
  .action(
    withErrorHandler(async (options: { status?: string; limit: string }) => {
      const apiKey = await requireApiKey();
      const baseUrl = getBaseUrl();

      const params = new URLSearchParams();
      if (options.status) params.set("status", options.status);
      params.set("limit", options.limit);

      const response = await fetch(`${baseUrl}/v1/sandboxes?${params}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new CLIError(`Failed to list sandboxes: ${response.statusText}`, ExitCode.GeneralError);
      }

      const data = (await response.json()) as {
        data: Array<{
          id: string;
          template_name?: string;
          template_id?: string;
          status: string;
          created_at: string;
        }>;
      };

      const sandboxes = data.data ?? [];

      if (sandboxes.length === 0) {
        info("No sandboxes found");
        console.log(chalk.gray('Create one with: hopx sandbox create'));
        return;
      }

      outputList(sandboxes.map(s => ({
        id: s.id,
        template: s.template_name ?? s.template_id ?? "-",
        status: s.status,
        created_at: s.created_at,
      })), {
        title: `Sandboxes (${sandboxes.length})`,
        columns: [
          { key: "id", header: "ID" },
          { key: "template", header: "Template" },
          { key: "status", header: "Status", format: statusFormat },
          { key: "created_at", header: "Created", format: relativeDate },
        ],
      });
    })
  );

// sandbox info
sandboxCommand
  .command("info")
  .description("Get sandbox details")
  .argument("<sandbox-id>", "Sandbox ID")
  .action(
    withErrorHandler(async (sandboxId: string) => {
      const apiKey = await requireApiKey();
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/sandboxes/${sandboxId}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new CLIError(`Sandbox not found: ${sandboxId}`, ExitCode.NotFoundError);
        }
        throw new CLIError(`Failed to get sandbox: ${response.statusText}`, ExitCode.GeneralError);
      }

      const sandbox = (await response.json()) as Record<string, unknown>;
      output(sandbox, { keyValueTitle: "Sandbox Details" });
    })
  );

// sandbox kill
sandboxCommand
  .command("kill")
  .description("Terminate a sandbox")
  .argument("<sandbox-id>", "Sandbox ID")
  .option("-y, --yes", "Skip confirmation")
  .action(
    withErrorHandler(async (sandboxId: string, options: { yes?: boolean }) => {
      if (!options.yes) {
        const rl = createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise<string>((resolve) => {
          rl.question(chalk.yellow(`Kill sandbox ${sandboxId}? (y/N): `), resolve);
        });
        rl.close();

        if (answer.toLowerCase() !== "y") {
          info("Cancelled");
          return;
        }
      }

      const apiKey = await requireApiKey();
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/sandboxes/${sandboxId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new CLIError(`Sandbox not found: ${sandboxId}`, ExitCode.NotFoundError);
        }
        throw new CLIError(`Failed to kill sandbox: ${response.statusText}`, ExitCode.GeneralError);
      }

      success(`Sandbox killed: ${sandboxId}`);
    })
  );

// sandbox pause
sandboxCommand
  .command("pause")
  .description("Pause a running sandbox")
  .argument("<sandbox-id>", "Sandbox ID")
  .action(
    withErrorHandler(async (sandboxId: string) => {
      const apiKey = await requireApiKey();
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/sandboxes/${sandboxId}/pause`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new CLIError(`Sandbox not found: ${sandboxId}`, ExitCode.NotFoundError);
        }
        throw new CLIError(`Failed to pause sandbox: ${response.statusText}`, ExitCode.GeneralError);
      }

      success(`Sandbox paused: ${sandboxId}`);
    })
  );

// sandbox resume
sandboxCommand
  .command("resume")
  .description("Resume a paused sandbox")
  .argument("<sandbox-id>", "Sandbox ID")
  .action(
    withErrorHandler(async (sandboxId: string) => {
      const apiKey = await requireApiKey();
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/sandboxes/${sandboxId}/resume`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new CLIError(`Sandbox not found: ${sandboxId}`, ExitCode.NotFoundError);
        }
        throw new CLIError(`Failed to resume sandbox: ${response.statusText}`, ExitCode.GeneralError);
      }

      success(`Sandbox resumed: ${sandboxId}`);
    })
  );

// sandbox timeout
sandboxCommand
  .command("timeout")
  .description("Set sandbox auto-kill timeout")
  .argument("<sandbox-id>", "Sandbox ID")
  .argument("<seconds>", "Timeout in seconds (0 to disable)")
  .action(
    withErrorHandler(async (sandboxId: string, seconds: string) => {
      const apiKey = await requireApiKey();
      const baseUrl = getBaseUrl();
      const timeout = parseInt(seconds, 10);

      const response = await fetch(`${baseUrl}/v1/sandboxes/${sandboxId}/timeout`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ timeout_seconds: timeout }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new CLIError(`Sandbox not found: ${sandboxId}`, ExitCode.NotFoundError);
        }
        throw new CLIError(`Failed to set timeout: ${response.statusText}`, ExitCode.GeneralError);
      }

      if (timeout === 0) {
        success(`Auto-kill disabled for sandbox: ${sandboxId}`);
      } else {
        success(`Timeout set to ${timeout}s for sandbox: ${sandboxId}`);
      }
    })
  );

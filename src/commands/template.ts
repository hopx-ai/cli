/**
 * template command - Template management
 */

import { Command } from "commander";
import { createInterface } from "readline";
import chalk from "chalk";
import { requireApiKey } from "../lib/auth/token.js";
import { getBaseUrl } from "../lib/config.js";
import { withErrorHandler, CLIError, ExitCode } from "../lib/errors.js";
import { success, info, withSpinner } from "../lib/output/progress.js";
import { outputList, output } from "../lib/output/index.js";
import { statusFormat, relativeDate } from "../lib/output/table.js";

export const templateCommand = new Command("template")
  .alias("tpl")
  .description("Template management");

// template list
templateCommand
  .command("list")
  .description("List available templates")
  .option("--custom", "Show only custom templates")
  .option("--official", "Show only official templates")
  .action(
    withErrorHandler(async (options: { custom?: boolean; official?: boolean }) => {
      const apiKey = await requireApiKey();
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/templates`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new CLIError(`Failed to list templates: ${response.statusText}`, ExitCode.GeneralError);
      }

      const data = (await response.json()) as {
        data: Array<{
          id: string;
          name: string;
          display_name?: string;
          description?: string;
          category?: string;
          created_at?: string;
        }>;
      };

      let templates = data.data ?? [];

      // Apply filters based on category
      if (options.custom) {
        templates = templates.filter((t) => t.category === "custom");
      } else if (options.official) {
        templates = templates.filter((t) => t.category !== "custom");
      }

      if (templates.length === 0) {
        info("No templates found");
        return;
      }

      outputList(
        templates.map((t) => ({
          name: t.display_name ?? t.name,
          id: t.id,
          category: t.category ?? "-",
          created_at: t.created_at,
        })),
        {
          title: `Templates (${templates.length})`,
          columns: [
            { key: "name", header: "Name" },
            { key: "id", header: "ID" },
            { key: "category", header: "Category" },
            { key: "created_at", header: "Created", format: relativeDate },
          ],
        }
      );
    })
  );

// template info
templateCommand
  .command("info")
  .description("Get template details")
  .argument("<name>", "Template name or ID")
  .action(
    withErrorHandler(async (name: string) => {
      const apiKey = await requireApiKey();
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/templates/${name}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new CLIError(`Template not found: ${name}`, ExitCode.NotFoundError);
        }
        throw new CLIError(`Failed to get template: ${response.statusText}`, ExitCode.GeneralError);
      }

      const template = (await response.json()) as Record<string, unknown>;
      output(template, { keyValueTitle: "Template Details" });
    })
  );

// template build
templateCommand
  .command("build")
  .description("Build a custom template")
  .requiredOption("-n, --name <name>", "Template name/alias")
  .option("--dockerfile <path>", "Path to Dockerfile")
  .option("--image <image>", "Base Docker image")
  .option("--start-cmd <cmd>", "Startup command")
  .option("--cpu <millicores>", "CPU limit in millicores", "1000")
  .option("--memory <mb>", "Memory limit in MB", "512")
  .action(
    withErrorHandler(
      async (options: {
        name: string;
        dockerfile?: string;
        image?: string;
        startCmd?: string;
        cpu: string;
        memory: string;
      }) => {
        const apiKey = await requireApiKey();
        const baseUrl = getBaseUrl();

        // Build request body
        const body: Record<string, unknown> = {
          alias: options.name,
          cpu_milli: parseInt(options.cpu, 10),
          memory_mb: parseInt(options.memory, 10),
        };

        if (options.image) {
          body.base_image = options.image;
        }

        if (options.startCmd) {
          body.start_cmd = options.startCmd;
        }

        // Start build
        const buildResponse = await withSpinner("Starting template build...", async () => {
          const response = await fetch(`${baseUrl}/v1/templates/build`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const error = await response.text();
            throw new CLIError(`Failed to start build: ${error}`, ExitCode.GeneralError);
          }

          return response.json() as Promise<{ build_id: string }>;
        });

        const buildId = buildResponse.build_id;
        info(`Build started: ${buildId}`);

        // Poll for build status
        console.log(chalk.gray("\nStreaming build logs...\n"));

        let lastLogOffset = 0;
        while (true) {
          // Get build status
          const statusResponse = await fetch(`${baseUrl}/v1/templates/build/${buildId}/status`, {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          });

          if (!statusResponse.ok) {
            throw new CLIError(`Failed to get build status`, ExitCode.GeneralError);
          }

          const status = (await statusResponse.json()) as {
            status: string;
            template_id?: string;
            error?: string;
          };

          // Get logs
          const logsResponse = await fetch(
            `${baseUrl}/v1/templates/build/${buildId}/logs?offset=${lastLogOffset}`,
            {
              headers: {
                Authorization: `Bearer ${apiKey}`,
              },
            }
          );

          if (logsResponse.ok) {
            const logs = (await logsResponse.json()) as { logs: string; offset: number };
            if (logs.logs) {
              process.stdout.write(logs.logs);
              lastLogOffset = logs.offset;
            }
          }

          // Check if done
          if (status.status === "active") {
            console.log(chalk.green("\nBuild completed successfully!"));
            success(`Template ready: ${options.name} (ID: ${status.template_id})`);
            break;
          } else if (status.status === "failed") {
            throw new CLIError(`Build failed: ${status.error}`, ExitCode.GeneralError);
          }

          // Wait before next poll
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    )
  );

// template delete
templateCommand
  .command("delete")
  .description("Delete a custom template")
  .argument("<id>", "Template ID")
  .option("-y, --yes", "Skip confirmation")
  .action(
    withErrorHandler(async (id: string, options: { yes?: boolean }) => {
      if (!options.yes) {
        const rl = createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise<string>((resolve) => {
          rl.question(chalk.yellow(`Delete template ${id}? (y/N): `), resolve);
        });
        rl.close();

        if (answer.toLowerCase() !== "y") {
          info("Cancelled");
          return;
        }
      }

      const apiKey = await requireApiKey();
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/templates/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new CLIError(`Template not found: ${id}`, ExitCode.NotFoundError);
        }
        throw new CLIError(`Failed to delete template: ${response.statusText}`, ExitCode.GeneralError);
      }

      success(`Template deleted: ${id}`);
    })
  );

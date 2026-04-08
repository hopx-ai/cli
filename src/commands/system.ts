/**
 * system command - Health and metrics
 */

import { Command } from "commander";
import chalk from "chalk";
import { getBaseUrl } from "../lib/config.js";
import { withErrorHandler, CLIError, ExitCode } from "../lib/errors.js";
import { success, info, error as errorMsg } from "../lib/output/progress.js";
import { output } from "../lib/output/index.js";
import { getOutputFormat } from "../lib/config.js";
import { VERSION } from "../version.js";

export const systemCommand = new Command("system")
  .description("System health and metrics");

// system health
systemCommand
  .command("health")
  .description("Check API health status")
  .action(
    withErrorHandler(async () => {
      const baseUrl = getBaseUrl();

      try {
        const startTime = Date.now();
        const response = await fetch(`${baseUrl}/health`);
        const latency = Date.now() - startTime;

        const format = getOutputFormat();

        if (response.ok) {
          const data = (await response.json()) as { status: string; version?: string };

          if (format === "json") {
            output({
              healthy: true,
              status: data.status,
              version: data.version,
              latency_ms: latency,
              api_url: baseUrl,
            });
          } else {
            success("API is healthy");
            output(
              {
                status: data.status,
                version: data.version ?? "unknown",
                latency: `${latency}ms`,
                api_url: baseUrl,
              },
              { keyValueTitle: "Health Check" }
            );
          }
        } else {
          if (format === "json") {
            output({
              healthy: false,
              status: "unhealthy",
              http_status: response.status,
              api_url: baseUrl,
            });
          } else {
            errorMsg(`API returned status ${response.status}`);
          }
          process.exit(1);
        }
      } catch (err) {
        const format = getOutputFormat();
        if (format === "json") {
          output({
            healthy: false,
            status: "unreachable",
            error: err instanceof Error ? err.message : String(err),
            api_url: baseUrl,
          });
        } else {
          errorMsg(`Cannot reach API at ${baseUrl}`);
          console.log(chalk.gray("Check your network connection and HOPX_BASE_URL setting"));
        }
        process.exit(1);
      }
    })
  );

// system version
systemCommand
  .command("version")
  .description("Show CLI and API versions")
  .action(
    withErrorHandler(async () => {
      const cliVersion = VERSION;

      // Get API version
      const baseUrl = getBaseUrl();
      let apiVersion = "unknown";

      try {
        const response = await fetch(`${baseUrl}/health`);
        if (response.ok) {
          const data = (await response.json()) as { version?: string };
          apiVersion = data.version ?? "unknown";
        }
      } catch {
        apiVersion = "unreachable";
      }

      const format = getOutputFormat();
      if (format === "json") {
        output({
          cli_version: cliVersion,
          api_version: apiVersion,
          api_url: baseUrl,
          runtime: typeof Bun !== "undefined" ? "bun" : "node",
          runtime_version: typeof Bun !== "undefined" ? Bun.version : process.version,
        });
      } else {
        output(
          {
            cli: cliVersion,
            api: apiVersion,
            runtime: typeof Bun !== "undefined" ? `Bun ${Bun.version}` : `Node.js ${process.version}`,
            api_url: baseUrl,
          },
          { keyValueTitle: "Version Information" }
        );
      }
    })
  );

// system metrics
systemCommand
  .command("metrics")
  .description("Show API metrics")
  .action(
    withErrorHandler(async () => {
      info("Metrics endpoint not yet implemented");
      console.log(chalk.gray("This feature will be available in a future release"));
    })
  );

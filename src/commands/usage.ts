/**
 * usage command - Usage statistics
 */

import { Command } from "commander";
import { requireApiKey } from "../lib/auth/token.js";
import { getBaseUrl } from "../lib/config.js";
import { withErrorHandler, CLIError, ExitCode } from "../lib/errors.js";
import { info } from "../lib/output/progress.js";
import { output, outputList } from "../lib/output/index.js";

export const usageCommand = new Command("usage")
  .description("Usage statistics");

// usage summary (default)
usageCommand
  .command("summary", { isDefault: true })
  .description("Show usage summary for current period")
  .action(
    withErrorHandler(async () => {
      const apiKey = await requireApiKey();
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/usage`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new CLIError(
          `Failed to get usage: ${response.statusText}`,
          ExitCode.GeneralError
        );
      }

      const usage = (await response.json()) as Record<string, unknown>;
      output(usage, { keyValueTitle: "Usage Summary" });
    })
  );

// usage daily
usageCommand
  .command("daily")
  .description("Show daily usage breakdown")
  .option("-d, --days <n>", "Number of days to show", "7")
  .action(
    withErrorHandler(async (options: { days: string }) => {
      const apiKey = await requireApiKey();
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/usage/daily?days=${options.days}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new CLIError(
          `Failed to get daily usage: ${response.statusText}`,
          ExitCode.GeneralError
        );
      }

      const data = (await response.json()) as {
        daily: Array<{
          date: string;
          sandboxes: number;
          compute_seconds: number;
          api_calls: number;
        }>;
      };

      if (data.daily.length === 0) {
        info("No usage data available");
        return;
      }

      outputList(
        data.daily.map((d) => ({
          date: d.date,
          sandboxes: d.sandboxes,
          compute: formatDuration(d.compute_seconds),
          api_calls: d.api_calls,
        })),
        {
          title: `Daily Usage (Last ${options.days} days)`,
          columns: [
            { key: "date", header: "Date" },
            { key: "sandboxes", header: "Sandboxes" },
            { key: "compute", header: "Compute Time" },
            { key: "api_calls", header: "API Calls" },
          ],
        }
      );
    })
  );

// usage by-template
usageCommand
  .command("by-template")
  .description("Show usage breakdown by template")
  .action(
    withErrorHandler(async () => {
      const apiKey = await requireApiKey();
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/usage/by-template`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new CLIError(
          `Failed to get usage by template: ${response.statusText}`,
          ExitCode.GeneralError
        );
      }

      const data = (await response.json()) as {
        templates: Array<{
          template: string;
          sandboxes: number;
          compute_seconds: number;
        }>;
      };

      if (data.templates.length === 0) {
        info("No usage data available");
        return;
      }

      outputList(
        data.templates.map((t) => ({
          template: t.template,
          sandboxes: t.sandboxes,
          compute: formatDuration(t.compute_seconds),
        })),
        {
          title: "Usage by Template",
          columns: [
            { key: "template", header: "Template" },
            { key: "sandboxes", header: "Sandboxes" },
            { key: "compute", header: "Compute Time" },
          ],
        }
      );
    })
  );

/**
 * Format duration in seconds to human readable
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

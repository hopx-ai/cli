/**
 * billing command - Billing information
 */

import { Command } from "commander";
import chalk from "chalk";
import { requireApiKey } from "../lib/auth/token.js";
import { getBaseUrl } from "../lib/config.js";
import { withErrorHandler, CLIError, ExitCode } from "../lib/errors.js";
import { info } from "../lib/output/progress.js";
import { output, outputList } from "../lib/output/index.js";
import { relativeDate } from "../lib/output/table.js";

export const billingCommand = new Command("billing")
  .description("Billing information");

// billing info (default)
billingCommand
  .command("info", { isDefault: true })
  .description("Show billing summary")
  .action(
    withErrorHandler(async () => {
      const apiKey = await requireApiKey();
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/billing`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new CLIError(
          `Failed to get billing info: ${response.statusText}`,
          ExitCode.GeneralError
        );
      }

      const billing = (await response.json()) as Record<string, unknown>;
      output(billing, { keyValueTitle: "Billing Summary" });
    })
  );

// billing plan
billingCommand
  .command("plan")
  .description("Show current plan details")
  .action(
    withErrorHandler(async () => {
      const apiKey = await requireApiKey();
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/billing/plan`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new CLIError(
          `Failed to get plan info: ${response.statusText}`,
          ExitCode.GeneralError
        );
      }

      const plan = (await response.json()) as Record<string, unknown>;
      output(plan, { keyValueTitle: "Current Plan" });
    })
  );

// billing invoices
billingCommand
  .command("invoices")
  .description("List recent invoices")
  .option("-l, --limit <n>", "Number of invoices to show", "10")
  .action(
    withErrorHandler(async (options: { limit: string }) => {
      const apiKey = await requireApiKey();
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/billing/invoices?limit=${options.limit}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new CLIError(
          `Failed to get invoices: ${response.statusText}`,
          ExitCode.GeneralError
        );
      }

      const data = (await response.json()) as {
        invoices: Array<{
          id: string;
          date: string;
          amount: number;
          currency: string;
          status: string;
        }>;
      };

      if (data.invoices.length === 0) {
        info("No invoices found");
        return;
      }

      outputList(
        data.invoices.map((inv) => ({
          id: inv.id,
          date: inv.date,
          amount: formatAmount(inv.amount, inv.currency),
          status: inv.status,
        })),
        {
          title: "Invoices",
          columns: [
            { key: "id", header: "Invoice ID" },
            { key: "date", header: "Date", format: relativeDate },
            { key: "amount", header: "Amount" },
            { key: "status", header: "Status" },
          ],
        }
      );
    })
  );

// billing portal
billingCommand
  .command("portal")
  .description("Open billing portal in browser")
  .action(
    withErrorHandler(async () => {
      const apiKey = await requireApiKey();
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/billing/portal`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new CLIError(
          `Failed to get portal URL: ${response.statusText}`,
          ExitCode.GeneralError
        );
      }

      const data = (await response.json()) as { url: string };

      console.log(chalk.cyan("Opening billing portal..."));
      console.log(chalk.gray(`URL: ${data.url}`));

      const open = await import("open");
      await open.default(data.url);
    })
  );

/**
 * Format currency amount
 */
function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

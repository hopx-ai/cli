/**
 * members command - Organization member management
 */

import { Command } from "commander";
import chalk from "chalk";
import { createInterface } from "readline";
import { requireApiKey } from "../lib/auth/token.js";
import { getBaseUrl } from "../lib/config.js";
import { withErrorHandler, CLIError, ExitCode } from "../lib/errors.js";
import { success, info } from "../lib/output/progress.js";
import { outputList, output } from "../lib/output/index.js";
import { relativeDate } from "../lib/output/table.js";

export const membersCommand = new Command("members")
  .description("Organization member management");

// members list
membersCommand
  .command("list")
  .description("List organization members")
  .action(
    withErrorHandler(async () => {
      const apiKey = await requireApiKey();
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/organization/members`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new CLIError(
          `Failed to list members: ${response.statusText}`,
          ExitCode.GeneralError
        );
      }

      const data = (await response.json()) as {
        members: Array<{
          id: string;
          email: string;
          name?: string;
          role: string;
          joined_at: string;
        }>;
      };

      if (data.members.length === 0) {
        info("No members found");
        return;
      }

      outputList(data.members, {
        title: `Organization Members (${data.members.length})`,
        columns: [
          { key: "email", header: "Email" },
          { key: "name", header: "Name" },
          { key: "role", header: "Role" },
          { key: "joined_at", header: "Joined", format: relativeDate },
        ],
      });
    })
  );

// members invite
membersCommand
  .command("invite")
  .description("Invite a new member")
  .argument("<email>", "Email address to invite")
  .option("-r, --role <role>", "Member role", "member")
  .action(
    withErrorHandler(async (email: string, options: { role: string }) => {
      const apiKey = await requireApiKey();
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/organization/members/invite`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          role: options.role,
        }),
      });

      if (!response.ok) {
        throw new CLIError(
          `Failed to send invite: ${response.statusText}`,
          ExitCode.GeneralError
        );
      }

      success(`Invitation sent to: ${email}`);
    })
  );

// members remove
membersCommand
  .command("remove")
  .description("Remove a member from organization")
  .argument("<email>", "Email of member to remove")
  .option("-y, --yes", "Skip confirmation")
  .action(
    withErrorHandler(async (email: string, options: { yes?: boolean }) => {
      if (!options.yes) {
        const rl = createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise<string>((resolve) => {
          rl.question(chalk.yellow(`Remove ${email} from organization? (y/N): `), resolve);
        });
        rl.close();

        if (answer.toLowerCase() !== "y") {
          info("Cancelled");
          return;
        }
      }

      const apiKey = await requireApiKey();
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/organization/members/${encodeURIComponent(email)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new CLIError(
          `Failed to remove member: ${response.statusText}`,
          ExitCode.GeneralError
        );
      }

      success(`Member removed: ${email}`);
    })
  );

/**
 * files command - File operations
 */

import { Command } from "commander";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { basename } from "path";
import chalk from "chalk";
import { Sandbox } from "@hopx-ai/sdk";
import { requireApiKey } from "../lib/auth/token.js";
import { getBaseUrl } from "../lib/config.js";
import { withErrorHandler, CLIError, ExitCode } from "../lib/errors.js";
import { success, info } from "../lib/output/progress.js";
import { outputList, output } from "../lib/output/index.js";
import { relativeDate } from "../lib/output/table.js";

export const filesCommand = new Command("files")
  .alias("f")
  .description("File operations in sandboxes");

// files read
filesCommand
  .command("read")
  .description("Read file content from sandbox")
  .argument("<path>", "Remote file path")
  .requiredOption("-s, --sandbox <id>", "Sandbox ID")
  .option("-o, --output <file>", "Save to local file instead of stdout")
  .action(
    withErrorHandler(async (remotePath: string, options: { sandbox: string; output?: string }) => {
      const apiKey = await requireApiKey();
      const sandbox = await Sandbox.connect(options.sandbox, apiKey, getBaseUrl());

      const content = await sandbox.files.read(remotePath);

      if (options.output) {
        writeFileSync(options.output, content);
        success(`File saved to: ${options.output}`);
      } else {
        console.log(content);
      }
    })
  );

// files write
filesCommand
  .command("write")
  .description("Write content to a file in sandbox")
  .argument("<path>", "Remote file path")
  .requiredOption("-s, --sandbox <id>", "Sandbox ID")
  .option("-c, --content <text>", "Content to write")
  .option("-f, --file <path>", "Local file to upload")
  .action(
    withErrorHandler(
      async (
        remotePath: string,
        options: { sandbox: string; content?: string; file?: string }
      ) => {
        if (!options.content && !options.file) {
          throw new CLIError(
            "Either --content or --file must be specified",
            ExitCode.ValidationError
          );
        }

        const apiKey = await requireApiKey();
        const sandbox = await Sandbox.connect(options.sandbox, apiKey, getBaseUrl());

        let content: string;
        if (options.file) {
          if (!existsSync(options.file)) {
            throw new CLIError(`Local file not found: ${options.file}`, ExitCode.NotFoundError);
          }
          content = readFileSync(options.file, "utf-8");
        } else {
          content = options.content!;
        }

        await sandbox.files.write(remotePath, content);
        success(`File written: ${remotePath}`);
      }
    )
  );

// files list
filesCommand
  .command("list")
  .description("List files in a directory")
  .argument("[path]", "Remote directory path", "/")
  .requiredOption("-s, --sandbox <id>", "Sandbox ID")
  .action(
    withErrorHandler(async (remotePath: string, options: { sandbox: string }) => {
      const apiKey = await requireApiKey();
      const sandbox = await Sandbox.connect(options.sandbox, apiKey, getBaseUrl());

      const files = await sandbox.files.list(remotePath);

      if (files.length === 0) {
        info(`No files found in: ${remotePath}`);
        return;
      }

      outputList(
        files.map((f) => ({
          name: f.name,
          type: f.isDir ? "dir" : "file",
          size: f.isDir ? "-" : formatSize(f.size ?? 0),
          modified: f.modTime,
        })),
        {
          title: `Files in ${remotePath}`,
          columns: [
            { key: "name", header: "Name" },
            { key: "type", header: "Type" },
            { key: "size", header: "Size" },
            { key: "modified", header: "Modified", format: relativeDate },
          ],
        }
      );
    })
  );

// files delete
filesCommand
  .command("delete")
  .description("Delete a file from sandbox")
  .argument("<path>", "Remote file path")
  .requiredOption("-s, --sandbox <id>", "Sandbox ID")
  .option("-y, --yes", "Skip confirmation")
  .action(
    withErrorHandler(async (remotePath: string, options: { sandbox: string; yes?: boolean }) => {
      if (!options.yes) {
        const readline = await import("readline");
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise<string>((resolve) => {
          rl.question(chalk.yellow(`Delete ${remotePath}? (y/N): `), resolve);
        });
        rl.close();

        if (answer.toLowerCase() !== "y") {
          info("Cancelled");
          return;
        }
      }

      const apiKey = await requireApiKey();
      const sandbox = await Sandbox.connect(options.sandbox, apiKey, getBaseUrl());

      await sandbox.files.delete(remotePath);
      success(`File deleted: ${remotePath}`);
    })
  );

// files upload
filesCommand
  .command("upload")
  .description("Upload a local file to sandbox")
  .argument("<local-path>", "Local file path")
  .argument("[remote-path]", "Remote destination path")
  .requiredOption("-s, --sandbox <id>", "Sandbox ID")
  .action(
    withErrorHandler(
      async (localPath: string, remotePath: string | undefined, options: { sandbox: string }) => {
        if (!existsSync(localPath)) {
          throw new CLIError(`Local file not found: ${localPath}`, ExitCode.NotFoundError);
        }

        const apiKey = await requireApiKey();
        const sandbox = await Sandbox.connect(options.sandbox, apiKey, getBaseUrl());

        // Default remote path to /workspace/<filename>
        const destPath = remotePath ?? `/workspace/${basename(localPath)}`;
        const content = readFileSync(localPath, "utf-8");

        await sandbox.files.write(destPath, content);
        success(`Uploaded: ${localPath} -> ${destPath}`);
      }
    )
  );

// files download
filesCommand
  .command("download")
  .description("Download a file from sandbox")
  .argument("<remote-path>", "Remote file path")
  .argument("[local-path]", "Local destination path")
  .requiredOption("-s, --sandbox <id>", "Sandbox ID")
  .action(
    withErrorHandler(
      async (remotePath: string, localPath: string | undefined, options: { sandbox: string }) => {
        const apiKey = await requireApiKey();
        const sandbox = await Sandbox.connect(options.sandbox, apiKey, getBaseUrl());

        // Default local path to current directory with same filename
        const destPath = localPath ?? basename(remotePath);
        const content = await sandbox.files.read(remotePath);

        writeFileSync(destPath, content);
        success(`Downloaded: ${remotePath} -> ${destPath}`);
      }
    )
  );

/**
 * Format file size for display
 */
function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

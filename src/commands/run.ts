/**
 * run command - Code execution
 */

import { Command } from "commander";
import { readFileSync, existsSync } from "fs";
import chalk from "chalk";
import { Sandbox } from "@hopx-ai/sdk";
import { requireApiKey } from "../lib/auth/token.js";
import { getDefaultTemplate, getBaseUrl } from "../lib/config.js";
import { withErrorHandler, CLIError, ExitCode } from "../lib/errors.js";
import { info, withSpinner } from "../lib/output/progress.js";
import { output } from "../lib/output/index.js";
import { getOutputFormat } from "../lib/config.js";

export const runCommand = new Command("run")
  .description("Execute code in a sandbox")
  .argument("<code>", "Code to execute or path to file")
  .option("-s, --sandbox <id>", "Sandbox ID (creates new if not specified)")
  .option("-l, --language <lang>", "Language: python, javascript, bash", "python")
  .option("-t, --template <name>", "Template for new sandbox")
  .option("-k, --keep", "Keep sandbox alive after execution")
  .option("--timeout <seconds>", "Execution timeout", "30")
  .option("-w, --workdir <path>", "Working directory")
  .action(
    withErrorHandler(
      async (
        code: string,
        options: {
          sandbox?: string;
          language: string;
          template?: string;
          keep?: boolean;
          timeout: string;
          workdir?: string;
        }
      ) => {
        const apiKey = await requireApiKey();

        // Check if code is a file path
        let codeToRun = code;
        let sourceFile: string | undefined;

        if (existsSync(code)) {
          sourceFile = code;
          codeToRun = readFileSync(code, "utf-8");

          // Auto-detect language from extension
          if (!options.language || options.language === "python") {
            if (code.endsWith(".js") || code.endsWith(".ts")) {
              options.language = "javascript";
            } else if (code.endsWith(".sh") || code.endsWith(".bash")) {
              options.language = "bash";
            }
          }

          info(`Executing file: ${code}`);
        }

        // Get or create sandbox
        let sandbox: Sandbox;
        let createdSandbox = false;

        if (options.sandbox) {
          sandbox = await Sandbox.connect(options.sandbox, apiKey, getBaseUrl());
        } else {
          const template = options.template ?? getDefaultTemplate();
          const baseURL = getBaseUrl();
          sandbox = await withSpinner(
            `Creating sandbox with template: ${template}`,
            () => Sandbox.create({ template, apiKey, baseURL }),
            { successMessage: "Sandbox ready" }
          );
          createdSandbox = true;
        }

        try {
          // Execute code
          const timeout = parseInt(options.timeout, 10);

          info(`Running ${options.language} code...`);

          const result = await sandbox.runCode(codeToRun, {
            language: options.language as "python" | "javascript" | "bash",
            timeoutMs: timeout * 1000,
            workingDir: options.workdir,
          });

          // Display results
          const format = getOutputFormat();

          if (format === "json") {
            output({
              sandbox_id: sandbox.sandboxId,
              source_file: sourceFile,
              language: options.language,
              exit_code: result.exitCode,
              stdout: result.stdout,
              stderr: result.stderr,
              rich_outputs: result.richOutputs?.length ?? 0,
            });
          } else {
            // Print stdout
            if (result.stdout) {
              console.log(result.stdout);
            }

            // Print stderr in red
            if (result.stderr) {
              console.error(chalk.red(result.stderr));
            }

            // Note about rich outputs
            if (result.richOutputs && result.richOutputs.length > 0) {
              console.log(
                chalk.gray(`\n[${result.richOutputs.length} rich output(s) captured - use --output json to see]`)
              );
            }

            // Exit code info if non-zero
            if (result.exitCode !== 0) {
              console.log(chalk.yellow(`\nExit code: ${result.exitCode}`));
            }
          }
        } finally {
          // Cleanup sandbox if we created it and --keep not specified
          if (createdSandbox && !options.keep) {
            await sandbox.kill();
            info(`Sandbox ${sandbox.sandboxId} terminated`);
          } else if (createdSandbox && options.keep) {
            info(`Sandbox ${sandbox.sandboxId} kept alive`);
          }
        }
      }
    )
  );

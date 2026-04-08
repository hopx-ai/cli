/**
 * self-update command - guidance for updating the Bun CLI
 *
 * The Python hopx-cli shipped a self-update command that called
 * `pipx upgrade` / `uv tool upgrade` in-place. The Bun CLI ships as
 * standalone binaries or via npm, so the "update" path is either
 * re-running the installer or `npm install -g @hopx-ai/cli@latest`.
 *
 * This command exists primarily to prevent a silent "unknown command"
 * error for users running `hopx self-update` out of muscle memory.
 */

import { Command } from "commander";
import chalk from "chalk";

const INSTALL_URL =
  "https://raw.githubusercontent.com/hopx-ai/cli/main/install.sh";

export const selfUpdateCommand = new Command("self-update")
  .description("Show how to update the Hopx CLI")
  .action(() => {
    console.log(chalk.bold("Update the Hopx CLI\n"));
    console.log("Standalone binary (installed via curl | bash):");
    console.log(chalk.cyan(`  curl -fsSL ${INSTALL_URL} | bash\n`));
    console.log("npm-installed:");
    console.log(chalk.cyan("  npm install -g @hopx-ai/cli@latest\n"));
    console.log(
      chalk.gray(
        "Note: the Python hopx-cli on PyPI is deprecated. See https://github.com/hopx-ai/cli for details."
      )
    );
  });

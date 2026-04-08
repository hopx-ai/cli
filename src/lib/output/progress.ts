/**
 * Progress indicators and spinners using ora
 */

import ora, { type Ora } from "ora";
import chalk from "chalk";

/**
 * Create a spinner with a message
 */
export function createSpinner(message: string): Ora {
  return ora({
    text: message,
    color: "cyan",
  });
}

/**
 * Run an async operation with a spinner
 */
export async function withSpinner<T>(
  message: string,
  operation: () => Promise<T>,
  options?: {
    successMessage?: string;
    failMessage?: string;
  }
): Promise<T> {
  const spinner = createSpinner(message).start();

  try {
    const result = await operation();
    spinner.succeed(options?.successMessage ?? message);
    return result;
  } catch (error) {
    spinner.fail(options?.failMessage ?? `Failed: ${message}`);
    throw error;
  }
}

/**
 * Display a success message
 */
export function success(message: string): void {
  console.log(chalk.green("✓") + " " + message);
}

/**
 * Display an info message
 */
export function info(message: string): void {
  console.log(chalk.blue("ℹ") + " " + message);
}

/**
 * Display a warning message
 */
export function warn(message: string): void {
  console.log(chalk.yellow("⚠") + " " + message);
}

/**
 * Display an error message
 */
export function error(message: string): void {
  console.log(chalk.red("✗") + " " + message);
}

/**
 * Simple progress bar for operations with known count
 */
export class ProgressBar {
  private current = 0;
  private width = 30;

  constructor(
    private total: number,
    private label: string = ""
  ) {}

  update(current: number): void {
    this.current = current;
    this.render();
  }

  increment(): void {
    this.current++;
    this.render();
  }

  private render(): void {
    const percent = Math.min(100, Math.round((this.current / this.total) * 100));
    const filled = Math.round((this.current / this.total) * this.width);
    const empty = this.width - filled;

    const bar = chalk.cyan("█".repeat(filled)) + chalk.gray("░".repeat(empty));
    const status = `${this.current}/${this.total}`;

    // Clear line and write progress
    process.stdout.write(`\r${this.label} ${bar} ${percent}% ${status}`);

    if (this.current >= this.total) {
      process.stdout.write("\n");
    }
  }

  complete(): void {
    this.current = this.total;
    this.render();
  }
}

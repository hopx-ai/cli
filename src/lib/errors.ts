/**
 * Error handling for Hopx CLI
 * Maps SDK errors to CLI exit codes and provides user-friendly messages
 */

import chalk from "chalk";
import {
  HopxError,
  AuthenticationError,
  NotFoundError,
  ValidationError,
  NetworkError,
  TimeoutError,
  RateLimitError,
  ServerError,
  TokenExpiredError,
  TemplateNotFoundError,
} from "@hopx-ai/sdk";

/**
 * CLI exit codes matching Python CLI conventions
 */
export enum ExitCode {
  Success = 0,
  GeneralError = 1,
  ValidationError = 2,
  AuthenticationError = 3,
  NotFoundError = 4,
  TimeoutError = 5,
  NetworkError = 6,
  RateLimitError = 7,
  Interrupted = 130,
}

/**
 * CLI-specific error with exit code and suggestion
 */
export class CLIError extends Error {
  constructor(
    message: string,
    public exitCode: ExitCode = ExitCode.GeneralError,
    public suggestion?: string
  ) {
    super(message);
    this.name = "CLIError";
  }
}

/**
 * Map SDK errors to CLI exit codes
 */
export function getExitCode(error: unknown): ExitCode {
  if (error instanceof CLIError) {
    return error.exitCode;
  }

  if (error instanceof AuthenticationError || error instanceof TokenExpiredError) {
    return ExitCode.AuthenticationError;
  }

  if (error instanceof NotFoundError || error instanceof TemplateNotFoundError) {
    return ExitCode.NotFoundError;
  }

  if (error instanceof ValidationError) {
    return ExitCode.ValidationError;
  }

  if (error instanceof TimeoutError) {
    return ExitCode.TimeoutError;
  }

  if (error instanceof NetworkError) {
    return ExitCode.NetworkError;
  }

  if (error instanceof RateLimitError) {
    return ExitCode.RateLimitError;
  }

  if (error instanceof HopxError || error instanceof ServerError) {
    return ExitCode.GeneralError;
  }

  return ExitCode.GeneralError;
}

/**
 * Get a helpful suggestion for an error
 */
export function getSuggestion(error: unknown): string | undefined {
  if (error instanceof CLIError) {
    return error.suggestion;
  }

  if (error instanceof AuthenticationError || error instanceof TokenExpiredError) {
    return 'Run "hopx auth login" to authenticate';
  }

  if (error instanceof NotFoundError) {
    return 'Use "hopx sandbox list" to see available sandboxes';
  }

  if (error instanceof TemplateNotFoundError) {
    return 'Use "hopx template list" to see available templates';
  }

  if (error instanceof NetworkError) {
    return "Check your network connection and try again";
  }

  if (error instanceof RateLimitError) {
    return "Wait a moment and try again";
  }

  if (error instanceof TimeoutError) {
    return "The operation timed out. Try increasing the timeout with --timeout";
  }

  return undefined;
}

/**
 * Format an error for display
 */
export function formatError(error: unknown): string {
  const lines: string[] = [];

  // Error message
  const message = error instanceof Error ? error.message : String(error);
  lines.push(chalk.red(`Error: ${message}`));

  // Suggestion
  const suggestion = getSuggestion(error);
  if (suggestion) {
    lines.push(chalk.yellow(`Suggestion: ${suggestion}`));
  }

  // Debug info for SDK errors
  if (error instanceof HopxError && process.env.DEBUG) {
    lines.push(chalk.gray(`\nDebug info:`));
    lines.push(chalk.gray(`  Error type: ${error.constructor.name}`));
    if (error.stack) {
      lines.push(chalk.gray(`  Stack: ${error.stack.split("\n").slice(1, 4).join("\n  ")}`));
    }
  }

  return lines.join("\n");
}

/**
 * Handle an error and exit with appropriate code
 */
export function handleError(error: unknown): never {
  console.error(formatError(error));
  process.exit(getExitCode(error));
}

/**
 * Wrapper for async command handlers with error handling
 */
export function withErrorHandler<T extends unknown[]>(
  fn: (...args: T) => Promise<void>
): (...args: T) => Promise<void> {
  return async (...args: T) => {
    try {
      await fn(...args);
    } catch (error) {
      handleError(error);
    }
  };
}

/**
 * Assert that a value is defined, throwing CLIError if not
 */
export function assertDefined<T>(
  value: T | undefined | null,
  message: string,
  suggestion?: string
): asserts value is T {
  if (value === undefined || value === null) {
    throw new CLIError(message, ExitCode.ValidationError, suggestion);
  }
}

/**
 * Assert that the API key is configured
 */
export function assertApiKey(apiKey: string | undefined): asserts apiKey is string {
  assertDefined(
    apiKey,
    "No API key configured",
    'Set HOPX_API_KEY environment variable or run "hopx auth login"'
  );
}

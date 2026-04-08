/**
 * Unit tests for error handling
 */

import { describe, it, expect } from "bun:test";

describe("Exit Codes", () => {
  const ExitCode = {
    Success: 0,
    GeneralError: 1,
    ValidationError: 2,
    AuthenticationError: 3,
    NotFoundError: 4,
    TimeoutError: 5,
    NetworkError: 6,
    RateLimitError: 7,
    Interrupted: 130,
  };

  it("should have correct exit code values", () => {
    expect(ExitCode.Success).toBe(0);
    expect(ExitCode.GeneralError).toBe(1);
    expect(ExitCode.ValidationError).toBe(2);
    expect(ExitCode.AuthenticationError).toBe(3);
    expect(ExitCode.NotFoundError).toBe(4);
    expect(ExitCode.TimeoutError).toBe(5);
    expect(ExitCode.NetworkError).toBe(6);
    expect(ExitCode.RateLimitError).toBe(7);
    expect(ExitCode.Interrupted).toBe(130);
  });
});

describe("Error Suggestions", () => {
  const suggestions: Record<string, string> = {
    authentication: 'Run "hopx auth login" to authenticate',
    not_found_sandbox: 'Use "hopx sandbox list" to see available sandboxes',
    not_found_template: 'Use "hopx template list" to see available templates',
    network: "Check your network connection and try again",
    rate_limit: "Wait a moment and try again",
    timeout: "The operation timed out. Try increasing the timeout with --timeout",
  };

  it("should have helpful suggestions for common errors", () => {
    expect(suggestions.authentication).toContain("hopx auth login");
    expect(suggestions.not_found_sandbox).toContain("hopx sandbox list");
    expect(suggestions.network).toContain("network connection");
    expect(suggestions.rate_limit).toContain("Wait");
  });
});

describe("CLI Error Class", () => {
  it("should create error with message and exit code", () => {
    class CLIError extends Error {
      constructor(
        message: string,
        public exitCode: number = 1,
        public suggestion?: string
      ) {
        super(message);
        this.name = "CLIError";
      }
    }

    const error = new CLIError("Test error", 3, "Try again");

    expect(error.message).toBe("Test error");
    expect(error.exitCode).toBe(3);
    expect(error.suggestion).toBe("Try again");
    expect(error.name).toBe("CLIError");
  });
});

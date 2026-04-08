/**
 * Unit tests for progress indicators and spinners
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  createSpinner,
  withSpinner,
  success,
  info,
  warn,
  error,
  ProgressBar,
} from "../../src/lib/output/progress.js";
import { OutputCapture } from "../helpers.js";

describe("Progress Indicators", () => {
  let capture: OutputCapture;

  beforeEach(() => {
    capture = new OutputCapture();
    capture.start();
  });

  afterEach(() => {
    capture.stop();
  });

  describe("createSpinner", () => {
    it("should create a spinner with the given message", () => {
      const spinner = createSpinner("Loading...");

      expect(spinner).toBeDefined();
      expect(spinner.text).toBe("Loading...");
    });

    it("should have cyan color by default", () => {
      const spinner = createSpinner("Test");

      expect(spinner.color).toBe("cyan");
    });
  });

  describe("withSpinner", () => {
    it("should show success on successful operation", async () => {
      await withSpinner(
        "Testing...",
        async () => {
          return "result";
        },
        { successMessage: "Done!" }
      );

      // Note: ora spinner output might not be captured in tests
      // This test mainly verifies no errors are thrown
    });

    it("should return the operation result", async () => {
      const result = await withSpinner("Testing...", async () => {
        return { data: "test" };
      });

      expect(result).toEqual({ data: "test" });
    });

    it("should propagate errors", async () => {
      const testError = new Error("Test error");

      await expect(
        withSpinner("Testing...", async () => {
          throw testError;
        })
      ).rejects.toThrow("Test error");
    });

    it("should use default success message when not provided", async () => {
      const result = await withSpinner("Loading data", async () => "success");

      expect(result).toBe("success");
    });
  });

  describe("Message Functions", () => {
    it("success should output green checkmark", () => {
      success("Operation completed");

      const output = capture.getOutput();
      expect(output).toContain("Operation completed");
      expect(output).toContain("✓");
    });

    it("info should output blue info symbol", () => {
      info("Some information");

      const output = capture.getOutput();
      expect(output).toContain("Some information");
      expect(output).toContain("ℹ");
    });

    it("warn should output yellow warning symbol", () => {
      warn("Warning message");

      const output = capture.getOutput();
      expect(output).toContain("Warning message");
      expect(output).toContain("⚠");
    });

    it("error should output red X symbol", () => {
      error("Error message");

      const output = capture.getOutput();
      expect(output).toContain("Error message");
      expect(output).toContain("✗");
    });
  });
});

describe("ProgressBar", () => {
  let capture: OutputCapture;

  beforeEach(() => {
    capture = new OutputCapture();
    capture.start();
  });

  afterEach(() => {
    capture.stop();
  });

  describe("constructor", () => {
    it("should create progress bar with total and label", () => {
      const bar = new ProgressBar(100, "Downloading");

      expect(bar).toBeDefined();
    });

    it("should create progress bar without label", () => {
      const bar = new ProgressBar(50);

      expect(bar).toBeDefined();
    });
  });

  describe("update", () => {
    it("should update progress to specific value", () => {
      const bar = new ProgressBar(100, "Progress");
      bar.update(50);

      const output = capture.getOutput();
      expect(output).toContain("50%");
      expect(output).toContain("50/100");
    });

    it("should render progress bar characters", () => {
      const bar = new ProgressBar(100);
      bar.update(50);

      const output = capture.getOutput();
      // Should contain filled and empty bar characters
      expect(output).toContain("█");
      expect(output).toContain("░");
    });
  });

  describe("increment", () => {
    it("should increment progress by 1", () => {
      const bar = new ProgressBar(10);
      bar.increment();

      const output = capture.getOutput();
      expect(output).toContain("1/10");
      expect(output).toContain("10%");
    });

    it("should increment multiple times", () => {
      const bar = new ProgressBar(10);
      bar.increment();
      bar.increment();
      bar.increment();

      const output = capture.getOutput();
      expect(output).toContain("3/10");
      expect(output).toContain("30%");
    });
  });

  describe("complete", () => {
    it("should set progress to 100%", () => {
      const bar = new ProgressBar(100, "Test");
      bar.complete();

      const output = capture.getOutput();
      expect(output).toContain("100%");
      expect(output).toContain("100/100");
    });
  });

  describe("edge cases", () => {
    it("should handle zero total gracefully", () => {
      const bar = new ProgressBar(0);
      // Should not throw
      expect(() => bar.update(0)).not.toThrow();
    });

    it("should handle values at 100%", () => {
      const bar = new ProgressBar(10);
      bar.update(10);

      const output = capture.getOutput();
      expect(output).toContain("100%");
      expect(output).toContain("10/10");
    });

    it("should include label in output", () => {
      const bar = new ProgressBar(10, "Uploading files");
      bar.update(5);

      const output = capture.getOutput();
      expect(output).toContain("Uploading files");
    });
  });
});

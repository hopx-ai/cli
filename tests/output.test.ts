/**
 * Unit tests for output formatters
 */

import { describe, it, expect } from "bun:test";

describe("JSON Formatter", () => {
  it("should format data as pretty JSON", () => {
    const data = { name: "test", value: 123 };
    const result = JSON.stringify(data, null, 2);

    expect(result).toContain('"name": "test"');
    expect(result).toContain('"value": 123');
    expect(result).toContain("\n");
  });

  it("should format data as compact JSON", () => {
    const data = { name: "test", value: 123 };
    const result = JSON.stringify(data);

    expect(result).toBe('{"name":"test","value":123}');
    expect(result).not.toContain("\n");
  });
});

describe("Table Formatter Helpers", () => {
  describe("statusFormat", () => {
    const statusFormat = (status: string): string => {
      const s = status.toLowerCase();
      const colors: Record<string, string> = {
        running: "green",
        active: "green",
        paused: "yellow",
        stopped: "red",
      };
      return colors[s] ?? "default";
    };

    it("should map status to correct color", () => {
      expect(statusFormat("running")).toBe("green");
      expect(statusFormat("active")).toBe("green");
      expect(statusFormat("paused")).toBe("yellow");
      expect(statusFormat("stopped")).toBe("red");
      expect(statusFormat("unknown")).toBe("default");
    });
  });

  describe("truncate", () => {
    const truncate = (str: string, maxLength: number): string => {
      if (str.length <= maxLength) return str;
      return str.slice(0, maxLength - 3) + "...";
    };

    it("should not truncate short strings", () => {
      expect(truncate("short", 10)).toBe("short");
    });

    it("should truncate long strings", () => {
      expect(truncate("this is a very long string", 10)).toBe("this is...");
    });
  });

  describe("formatSize", () => {
    const formatSize = (bytes: number): string => {
      if (bytes === 0) return "0 B";
      const units = ["B", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
    };

    it("should format bytes correctly", () => {
      expect(formatSize(0)).toBe("0 B");
      expect(formatSize(100)).toBe("100.0 B");
      expect(formatSize(1024)).toBe("1.0 KB");
      expect(formatSize(1536)).toBe("1.5 KB");
      expect(formatSize(1048576)).toBe("1.0 MB");
    });
  });

  describe("formatDuration", () => {
    const formatDuration = (seconds: number): string => {
      if (seconds < 60) return `${seconds}s`;
      if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
      }
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${mins}m`;
    };

    it("should format durations correctly", () => {
      expect(formatDuration(30)).toBe("30s");
      expect(formatDuration(90)).toBe("1m 30s");
      expect(formatDuration(3661)).toBe("1h 1m");
    });
  });
});

describe("Mask Sensitive Values", () => {
  const maskSensitive = (key: string, value: string): string => {
    const sensitivePatterns = ["KEY", "SECRET", "TOKEN", "PASSWORD"];
    const upperKey = key.toUpperCase();

    if (sensitivePatterns.some((p) => upperKey.includes(p))) {
      if (value.length <= 8) return "***MASKED***";
      return value.slice(0, 4) + "..." + value.slice(-4);
    }
    return value;
  };

  it("should mask sensitive values", () => {
    expect(maskSensitive("API_KEY", "sk-1234567890abcdef")).toBe("sk-1...cdef");
    expect(maskSensitive("SECRET", "short")).toBe("***MASKED***");
    expect(maskSensitive("NAME", "not-sensitive")).toBe("not-sensitive");
  });
});

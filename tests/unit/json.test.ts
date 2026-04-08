/**
 * Unit tests for JSON output formatter
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { formatJson, outputJson } from "../../src/lib/output/json.js";
import { OutputCapture } from "../helpers.js";

describe("JSON Output Formatter", () => {
  describe("formatJson", () => {
    it("should format simple object as pretty JSON by default", () => {
      const data = { name: "test", value: 42 };
      const result = formatJson(data);

      expect(result).toBe(JSON.stringify(data, null, 2));
      expect(result).toContain("\n");
    });

    it("should format as compact JSON when pretty is false", () => {
      const data = { name: "test", value: 42 };
      const result = formatJson(data, { pretty: false });

      expect(result).toBe(JSON.stringify(data));
      expect(result).not.toContain("\n");
    });

    it("should handle arrays", () => {
      const data = [1, 2, 3, { nested: true }];
      const result = formatJson(data);

      expect(result).toBe(JSON.stringify(data, null, 2));
    });

    it("should handle nested objects", () => {
      const data = {
        level1: {
          level2: {
            level3: "deep value",
          },
        },
      };
      const result = formatJson(data);

      expect(result).toContain("level1");
      expect(result).toContain("level2");
      expect(result).toContain("level3");
      expect(result).toContain("deep value");
    });

    it("should handle null", () => {
      const result = formatJson(null);
      expect(result).toBe("null");
    });

    it("should handle undefined (converts to undefined string)", () => {
      const result = formatJson(undefined);
      expect(result).toBe(undefined);
    });

    it("should handle empty object", () => {
      const result = formatJson({});
      expect(result).toBe("{}");
    });

    it("should handle empty array", () => {
      const result = formatJson([]);
      expect(result).toBe("[]");
    });

    it("should handle strings", () => {
      const result = formatJson("hello world");
      expect(result).toBe('"hello world"');
    });

    it("should handle numbers", () => {
      const result = formatJson(42);
      expect(result).toBe("42");
    });

    it("should handle booleans", () => {
      expect(formatJson(true)).toBe("true");
      expect(formatJson(false)).toBe("false");
    });

    it("should handle special characters in strings", () => {
      const data = { text: 'Line1\nLine2\t"quoted"' };
      const result = formatJson(data);

      expect(result).toContain("\\n");
      expect(result).toContain("\\t");
      expect(result).toContain('\\"');
    });

    it("should handle date objects (as ISO strings)", () => {
      const date = new Date("2024-01-15T12:00:00Z");
      const data = { created: date };
      const result = formatJson(data);

      expect(result).toContain("2024-01-15T12:00:00.000Z");
    });
  });

  describe("outputJson", () => {
    let capture: OutputCapture;

    beforeEach(() => {
      capture = new OutputCapture();
      capture.start();
    });

    afterEach(() => {
      capture.stop();
    });

    it("should output JSON to console", () => {
      const data = { test: true };
      outputJson(data);

      const output = capture.getOutput();
      expect(output).toContain('"test": true');
    });

    it("should output pretty JSON by default", () => {
      const data = { key: "value" };
      outputJson(data);

      const output = capture.getOutput();
      expect(output).toContain("\n");
    });

    it("should output compact JSON when specified", () => {
      const data = { key: "value" };
      outputJson(data, { pretty: false });

      const output = capture.getOutput();
      expect(output.trim()).toBe('{"key":"value"}');
    });
  });
});

describe("JSON Edge Cases", () => {
  it("should handle circular reference gracefully", () => {
    const obj: Record<string, unknown> = { name: "test" };
    obj.self = obj; // circular reference

    expect(() => formatJson(obj)).toThrow();
  });

  it("should handle BigInt values", () => {
    const data = { big: BigInt(9007199254740991) };

    // BigInt throws by default in JSON.stringify
    expect(() => formatJson(data)).toThrow();
  });

  it("should handle Map and Set (converts to empty object/array)", () => {
    const map = new Map([["key", "value"]]);
    const set = new Set([1, 2, 3]);

    // Maps and Sets serialize as empty objects in standard JSON
    expect(formatJson(map)).toBe("{}");
    expect(formatJson(set)).toBe("{}");
  });

  it("should handle very large objects", () => {
    const largeArray = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
      nested: { value: i * 2 },
    }));

    const result = formatJson(largeArray);
    expect(result.length).toBeGreaterThan(10000);
    expect(JSON.parse(result)).toHaveLength(1000);
  });

  it("should handle unicode characters", () => {
    const data = {
      emoji: "😀🎉",
      chinese: "你好世界",
      arabic: "مرحبا",
    };
    const result = formatJson(data);

    expect(result).toContain("😀🎉");
    expect(result).toContain("你好世界");
    expect(result).toContain("مرحبا");
  });
});

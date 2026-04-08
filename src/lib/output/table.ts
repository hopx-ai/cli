/**
 * Table output formatter using cli-table3
 */

import Table from "cli-table3";
import chalk from "chalk";

export interface TableColumn {
  key: string;
  header: string;
  width?: number;
  align?: "left" | "center" | "right";
  format?: (value: unknown) => string;
}

export interface TableOptions {
  title?: string;
  columns: TableColumn[];
  data: Record<string, unknown>[];
  compact?: boolean;
}

/**
 * Format a value for display in a table cell
 */
function formatValue(value: unknown, format?: (value: unknown) => string): string {
  if (format) {
    return format(value);
  }

  if (value === null || value === undefined) {
    return chalk.gray("-");
  }

  if (typeof value === "boolean") {
    return value ? chalk.green("Yes") : chalk.red("No");
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Create and format a table
 */
export function formatTable(options: TableOptions): string {
  const { title, columns, data, compact } = options;

  // Create table
  const table = new Table({
    head: columns.map((col) => chalk.bold(col.header)),
    colWidths: columns.map((col) => col.width),
    colAligns: columns.map((col) => col.align ?? "left"),
    style: {
      head: ["cyan"],
      border: compact ? [] : ["gray"],
    },
    chars: compact
      ? {
          top: "",
          "top-mid": "",
          "top-left": "",
          "top-right": "",
          bottom: "",
          "bottom-mid": "",
          "bottom-left": "",
          "bottom-right": "",
          left: "",
          "left-mid": "",
          mid: "",
          "mid-mid": "",
          right: "",
          "right-mid": "",
          middle: "  ",
        }
      : undefined,
  });

  // Add rows
  for (const row of data) {
    const cells = columns.map((col) => formatValue(row[col.key], col.format));
    table.push(cells);
  }

  // Build output
  const lines: string[] = [];

  if (title) {
    lines.push(chalk.bold(title));
    lines.push("");
  }

  lines.push(table.toString());

  if (data.length === 0) {
    lines.push(chalk.gray("No data found"));
  }

  return lines.join("\n");
}

/**
 * Format a key-value table (for showing single item details)
 */
export function formatKeyValue(
  data: Record<string, unknown>,
  options?: { title?: string }
): string {
  const lines: string[] = [];

  if (options?.title) {
    lines.push(chalk.bold(options.title));
    lines.push("");
  }

  const maxKeyLength = Math.max(...Object.keys(data).map((k) => k.length));

  for (const [key, value] of Object.entries(data)) {
    const paddedKey = key.padEnd(maxKeyLength);
    const formattedValue = formatValue(value);
    lines.push(`${chalk.cyan(paddedKey)}  ${formattedValue}`);
  }

  return lines.join("\n");
}

/**
 * Common status formatters
 */
export const statusFormat = (value: unknown): string => {
  const status = String(value).toLowerCase();
  switch (status) {
    case "running":
    case "active":
    case "success":
    case "completed":
      return chalk.green(status);
    case "paused":
    case "pending":
    case "building":
      return chalk.yellow(status);
    case "stopped":
    case "killed":
    case "failed":
    case "error":
      return chalk.red(status);
    default:
      return status;
  }
};

/**
 * Truncate a string to a maximum length
 */
export const truncate = (maxLength: number) => (value: unknown): string => {
  const str = String(value);
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + "...";
};

/**
 * Format a date relative to now
 */
export const relativeDate = (value: unknown): string => {
  if (!value) return chalk.gray("-");

  const date = new Date(String(value));
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
};

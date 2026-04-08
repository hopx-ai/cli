/**
 * Output formatting module
 * Re-exports all output utilities
 */

export * from "./table.js";
export * from "./json.js";
export * from "./progress.js";

import { getOutputFormat } from "../config.js";
import { formatTable, formatKeyValue, type TableOptions } from "./table.js";
import { formatJson } from "./json.js";

/**
 * Output data based on current output format setting
 */
export function output(
  data: unknown,
  options?: {
    tableOptions?: Omit<TableOptions, "data">;
    keyValueTitle?: string;
  }
): void {
  const format = getOutputFormat();

  switch (format) {
    case "json":
      console.log(formatJson(data));
      break;

    case "plain":
      if (Array.isArray(data)) {
        for (const item of data) {
          if (typeof item === "object" && item !== null) {
            console.log(Object.values(item).join("\t"));
          } else {
            console.log(String(item));
          }
        }
      } else if (typeof data === "object" && data !== null) {
        for (const [key, value] of Object.entries(data)) {
          console.log(`${key}: ${value}`);
        }
      } else {
        console.log(String(data));
      }
      break;

    case "table":
    default:
      if (Array.isArray(data) && options?.tableOptions) {
        console.log(
          formatTable({
            ...options.tableOptions,
            data: data as Record<string, unknown>[],
          })
        );
      } else if (typeof data === "object" && data !== null) {
        console.log(
          formatKeyValue(data as Record<string, unknown>, {
            title: options?.keyValueTitle,
          })
        );
      } else {
        console.log(String(data));
      }
      break;
  }
}

/**
 * Output a list of items
 */
export function outputList<T extends Record<string, unknown>>(
  items: T[],
  options: Omit<TableOptions, "data">
): void {
  output(items, { tableOptions: options });
}

/**
 * Output a single item
 */
export function outputItem(item: Record<string, unknown>, title?: string): void {
  output(item, { keyValueTitle: title });
}

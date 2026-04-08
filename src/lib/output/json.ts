/**
 * JSON output formatter
 */

export interface JsonOptions {
  pretty?: boolean;
}

/**
 * Format data as JSON
 */
export function formatJson(data: unknown, options?: JsonOptions): string {
  const pretty = options?.pretty ?? true;
  return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
}

/**
 * Output JSON to stdout
 */
export function outputJson(data: unknown, options?: JsonOptions): void {
  console.log(formatJson(data, options));
}

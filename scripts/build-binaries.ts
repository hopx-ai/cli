#!/usr/bin/env bun
/**
 * Build standalone binaries for all supported platforms
 */

import { $ } from "bun";
import { createHash } from "crypto";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join, basename } from "path";

const DIST_DIR = "./dist/bin";
const ENTRY_POINT = "./src/index.ts";

interface Target {
  name: string;
  bunTarget: string;
  outputName: string;
}

const TARGETS: Target[] = [
  { name: "macOS (Apple Silicon)", bunTarget: "bun-darwin-arm64", outputName: "hopx-darwin-arm64" },
  { name: "macOS (Intel)", bunTarget: "bun-darwin-x64", outputName: "hopx-darwin-x64" },
  { name: "Linux (x64)", bunTarget: "bun-linux-x64", outputName: "hopx-linux-x64" },
  { name: "Linux (ARM64)", bunTarget: "bun-linux-arm64", outputName: "hopx-linux-arm64" },
  { name: "Windows (x64)", bunTarget: "bun-windows-x64", outputName: "hopx-windows-x64.exe" },
];

async function buildBinary(target: Target): Promise<boolean> {
  const outputPath = join(DIST_DIR, target.outputName);

  console.log(`Building ${target.name}...`);

  try {
    await $`bun build ${ENTRY_POINT} --compile --target=${target.bunTarget} --outfile=${outputPath}`;
    console.log(`  ✓ ${target.outputName}`);
    return true;
  } catch (error) {
    console.error(`  ✗ Failed to build ${target.name}:`, error);
    return false;
  }
}

/**
 * Generate a SHA256SUMS file for all successfully built binaries.
 * Format matches `sha256sum`/`shasum -a 256` output: "<hex>  <filename>"
 * so that downstream tooling (including install.sh) can consume it
 * with standard tools.
 */
function writeChecksums(builtTargets: Target[]): void {
  const lines: string[] = [];
  for (const target of builtTargets) {
    const binaryPath = join(DIST_DIR, target.outputName);
    if (!existsSync(binaryPath)) continue;
    const hash = createHash("sha256").update(readFileSync(binaryPath)).digest("hex");
    lines.push(`${hash}  ${basename(target.outputName)}`);
  }
  const sumsPath = join(DIST_DIR, "SHA256SUMS");
  writeFileSync(sumsPath, lines.join("\n") + "\n");
  console.log(`  ✓ SHA256SUMS (${lines.length} entries)`);
}

async function main() {
  console.log("Building Hopx CLI binaries\n");

  // Ensure dist directory exists
  if (!existsSync(DIST_DIR)) {
    mkdirSync(DIST_DIR, { recursive: true });
  }

  // Parse arguments
  const args = process.argv.slice(2);
  const targetFilter = args.find((arg) => arg.startsWith("--target="))?.split("=")[1];

  // Filter targets if specified
  let targets = TARGETS;
  if (targetFilter) {
    targets = TARGETS.filter(
      (t) =>
        t.outputName.includes(targetFilter) || t.bunTarget.includes(targetFilter)
    );

    if (targets.length === 0) {
      console.error(`No targets match filter: ${targetFilter}`);
      console.log("Available targets:");
      for (const t of TARGETS) {
        console.log(`  - ${t.outputName} (${t.bunTarget})`);
      }
      process.exit(1);
    }
  }

  // Build each target
  const results: { target: Target; success: boolean }[] = [];

  for (const target of targets) {
    const success = await buildBinary(target);
    results.push({ target, success });
  }

  // Summary
  console.log("\nBuild Summary:");
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`  ✓ ${successful} successful`);
  if (failed > 0) {
    console.log(`  ✗ ${failed} failed`);
  }

  // Write SHA256SUMS for successful builds (used by install.sh verification
  // and by users who want to verify release artifacts out of band).
  if (successful > 0) {
    writeChecksums(results.filter((r) => r.success).map((r) => r.target));
  }

  console.log(`\nBinaries saved to: ${DIST_DIR}/`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();

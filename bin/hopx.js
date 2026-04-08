#!/usr/bin/env node
// Hopx CLI binary entry point for npm-installed package.
// The standalone binaries (dist/bin/hopx-*) bundle src/index.ts directly
// via bun build --compile and do not use this file.
import "../dist/index.js";

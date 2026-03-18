#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildEntry = join(__dirname, '..', 'build', 'index.js');

if (!existsSync(buildEntry)) {
	throw new Error(
		'Build output not found. This is a bug — please report it at https://github.com/DavidTeju/claude-inspector/issues'
	);
}

// Default to localhost:5174 for the CLI (adapter-node defaults to 0.0.0.0:3000)
process.env.HOST ??= 'localhost';
process.env.PORT ??= '5174';

await import(buildEntry);

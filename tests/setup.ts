import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

const PROJECT_FIXTURES_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)), 'fixtures/projects');

const tempDirectories = new Set<string>();

function findFixturePath(rootDir: string, fixtureName: string): string | null {
	for (const entry of readdirSync(rootDir)) {
		const entryPath = join(rootDir, entry);
		const entryStats = statSync(entryPath);

		if (entryStats.isDirectory()) {
			const nestedMatch = findFixturePath(entryPath, fixtureName);

			if (nestedMatch) {
				return nestedMatch;
			}

			continue;
		}

		if (extname(entry) === '.jsonl' && basename(entry, '.jsonl') === fixtureName) {
			return entryPath;
		}
	}

	return null;
}

export function getFixtureJsonlPath(fixtureName: string): string {
	const normalizedFixtureName = fixtureName.endsWith('.jsonl') ? basename(fixtureName, '.jsonl') : fixtureName;
	const directPath = resolve(PROJECT_FIXTURES_DIR, fixtureName.endsWith('.jsonl') ? fixtureName : `${fixtureName}.jsonl`);
	const matchedPath = statSafe(directPath)
		? directPath
		: findFixturePath(PROJECT_FIXTURES_DIR, normalizedFixtureName);

	if (matchedPath) {
		return matchedPath;
	}

	throw new Error(`Fixture "${fixtureName}" was not found in ${PROJECT_FIXTURES_DIR}`);
}

export function createTempDirectory(prefix = 'claude-inspector-test-'): string {
	const directory = mkdtempSync(join(tmpdir(), prefix));
	tempDirectories.add(directory);
	return directory;
}

afterEach(() => {
	for (const directory of tempDirectories) {
		rmSync(directory, { force: true, recursive: true });
	}

	tempDirectories.clear();
});

function statSafe(path: string): boolean {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
}

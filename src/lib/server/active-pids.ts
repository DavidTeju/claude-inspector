import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { getInspectorDataDir } from './paths.js';

const execFile = promisify(execFileCallback);
const ACTIVE_PIDS_PATH = path.join(getInspectorDataDir(), 'active-sessions.json');

interface ActivePidEntry {
	sessionId: string;
	pid: number;
	startTime: string;
	commandSignature: string;
}

let pidFileQueue: Promise<void> = Promise.resolve();

function withPidFileLock<T>(operation: () => Promise<T>): Promise<T> {
	const next = pidFileQueue.then(operation, operation);
	pidFileQueue = next.then(
		() => undefined,
		() => undefined
	);
	return next;
}

async function ensureInspectorDataDir(): Promise<void> {
	await mkdir(getInspectorDataDir(), { recursive: true });
}

async function readEntriesUnlocked(): Promise<ActivePidEntry[]> {
	try {
		const raw = await readFile(ACTIVE_PIDS_PATH, 'utf-8');
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];

		return parsed.filter(isActivePidEntry);
	} catch {
		return [];
	}
}

async function writeEntriesUnlocked(entries: ActivePidEntry[]): Promise<void> {
	await ensureInspectorDataDir();
	await writeFile(ACTIVE_PIDS_PATH, JSON.stringify(entries, null, '\t'), 'utf-8');
}

function isActivePidEntry(value: unknown): value is ActivePidEntry {
	if (!value || typeof value !== 'object') return false;

	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.sessionId === 'string' &&
		typeof candidate.pid === 'number' &&
		typeof candidate.startTime === 'string' &&
		typeof candidate.commandSignature === 'string'
	);
}

async function getProcessField(pid: number, field: 'lstart' | 'command'): Promise<string | null> {
	try {
		const { stdout } = await execFile('ps', ['-p', String(pid), '-o', `${field}=`]);
		const value = stdout.trim();
		return value || null;
	} catch {
		return null;
	}
}

async function describeProcess(
	pid: number
): Promise<Pick<ActivePidEntry, 'startTime' | 'commandSignature'> | null> {
	const [startTime, commandSignature] = await Promise.all([
		getProcessField(pid, 'lstart'),
		getProcessField(pid, 'command')
	]);

	if (!startTime || !commandSignature) {
		return null;
	}

	return { startTime, commandSignature };
}

export async function recordActiveSessionProcess(
	sessionId: string,
	pid: number | undefined
): Promise<void> {
	if (!pid) return;

	const details = await describeProcess(pid);
	if (!details) return;

	await withPidFileLock(async () => {
		const entries = await readEntriesUnlocked();
		const nextEntries = entries.filter((entry) => entry.sessionId !== sessionId);
		nextEntries.push({
			sessionId,
			pid,
			startTime: details.startTime,
			commandSignature: details.commandSignature
		});
		await writeEntriesUnlocked(nextEntries);
	});
}

export async function removeActiveSessionProcess(sessionId: string): Promise<void> {
	await withPidFileLock(async () => {
		const entries = await readEntriesUnlocked();
		const nextEntries = entries.filter((entry) => entry.sessionId !== sessionId);
		if (nextEntries.length === entries.length) return;
		await writeEntriesUnlocked(nextEntries);
	});
}

export async function cleanupOrphanedProcesses(): Promise<number> {
	return withPidFileLock(async () => {
		const entries = await readEntriesUnlocked();
		if (entries.length === 0) return 0;

		let killed = 0;
		const retainedEntries: ActivePidEntry[] = [];

		for (const entry of entries) {
			const details = await describeProcess(entry.pid);
			if (!details) {
				continue;
			}

			if (
				details.startTime === entry.startTime &&
				details.commandSignature === entry.commandSignature
			) {
				try {
					process.kill(entry.pid, 'SIGTERM');
					killed += 1;
				} catch {
					retainedEntries.push(entry);
				}
				continue;
			}

			// PID was reused by a different process. Drop the stale record.
		}

		await writeEntriesUnlocked(retainedEntries);
		return killed;
	});
}

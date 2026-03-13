import type { PermissionMode } from '$lib/shared/active-session-types.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { homedir } from 'os';

const CONFIG_DIR = path.join(homedir(), '.claude-inspector');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

export interface AppConfig {
	anthropicApiKey: string;
	defaultPermissionMode: PermissionMode;
	defaultModel: string;
	permissionTimeoutMinutes: number;
	sessionReapMinutes: number;
}

const DEFAULT_CONFIG: AppConfig = {
	anthropicApiKey: '',
	defaultPermissionMode: 'default',
	defaultModel: '',
	permissionTimeoutMinutes: 5,
	sessionReapMinutes: 30
};

/** Reads the app config from ~/.claude-inspector/config.json */
export async function getConfig(): Promise<AppConfig> {
	try {
		const raw = await readFile(CONFIG_PATH, 'utf-8');
		return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
	} catch {
		return { ...DEFAULT_CONFIG };
	}
}

/** Writes the app config to ~/.claude-inspector/config.json */
export async function saveConfig(config: Partial<AppConfig>): Promise<void> {
	const current = await getConfig();
	const merged = { ...current, ...config };
	await mkdir(CONFIG_DIR, { recursive: true });
	await writeFile(CONFIG_PATH, JSON.stringify(merged, null, '\t'), 'utf-8');
}

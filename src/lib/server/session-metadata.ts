import { MAX_PROMPT_PREVIEW_LENGTH } from '../constants.js';
import type { SessionEntry } from '../types.js';
import type { SessionFileDescriptor } from './session-discovery.js';
import {
	extractTextFromMessageContent,
	isAssistantRecord,
	isUserRecord
} from './session-schema.js';
import type { ClaudeSessionRecord, ParsedSessionRecord } from './session-schema.js';

interface TimestampInfo {
	created: string;
	modified: string;
	gitBranch: string;
}

interface ContentInfo {
	firstPrompt: string;
	lastPrompt: string;
	customTitle: string;
	nativeSummary: string;
	messageCount: number;
}

function extractTimestamps(records: ParsedSessionRecord[]): TimestampInfo {
	let created = '';
	let modified = '';
	let gitBranch = '';

	for (const { record } of records) {
		const timestamp = 'timestamp' in record ? record.timestamp : undefined;
		if (!created && timestamp) {
			created = timestamp;
		}
		if (timestamp) {
			modified = timestamp;
		}
		if ('gitBranch' in record && record.gitBranch && !gitBranch) {
			gitBranch = record.gitBranch;
		}
	}

	return { created, modified, gitBranch };
}

function extractContent(records: ParsedSessionRecord[]): ContentInfo {
	let firstPrompt = '';
	let lastPrompt = '';
	let customTitle = '';
	let nativeSummary = '';
	let messageCount = 0;
	const seenAssistantMessages = new Set<string>();

	for (const { record } of records) {
		extractContentFromRecord(record, {
			getFirstPrompt: () => firstPrompt,
			setFirstPrompt: (v: string) => {
				firstPrompt = v;
			},
			setLastPrompt: (v: string) => {
				lastPrompt = v;
			},
			getCustomTitle: () => customTitle,
			setCustomTitle: (v: string) => {
				customTitle = v;
			},
			getNativeSummary: () => nativeSummary,
			setNativeSummary: (v: string) => {
				nativeSummary = v;
			},
			incrementMessageCount: () => {
				messageCount += 1;
			},
			seenAssistantMessages
		});
	}

	return { firstPrompt, lastPrompt, customTitle, nativeSummary, messageCount };
}

interface ContentAccumulator {
	getFirstPrompt: () => string;
	setFirstPrompt: (v: string) => void;
	setLastPrompt: (v: string) => void;
	getCustomTitle: () => string;
	setCustomTitle: (v: string) => void;
	getNativeSummary: () => string;
	setNativeSummary: (v: string) => void;
	incrementMessageCount: () => void;
	seenAssistantMessages: Set<string>;
}

function extractUserContent(record: ClaudeSessionRecord, acc: ContentAccumulator): boolean {
	if (!isUserRecord(record)) return false;

	acc.incrementMessageCount();
	const text = extractTextFromMessageContent(record.message.content).trim();
	if (text && !acc.getFirstPrompt()) {
		acc.setFirstPrompt(truncate(text));
	}
	if (text) {
		acc.setLastPrompt(truncate(text));
	}
	return true;
}

function extractAssistantContent(record: ClaudeSessionRecord, acc: ContentAccumulator): boolean {
	if (!isAssistantRecord(record)) return false;

	const assistantMessageKey = record.message.id || record.uuid;
	if (!acc.seenAssistantMessages.has(assistantMessageKey)) {
		acc.seenAssistantMessages.add(assistantMessageKey);
		acc.incrementMessageCount();
	}
	return true;
}

function extractMetadataContent(record: ClaudeSessionRecord, acc: ContentAccumulator): void {
	if (record.type === 'custom-title' && record.customTitle.trim() && !acc.getCustomTitle()) {
		acc.setCustomTitle(record.customTitle.trim());
		return;
	}

	if (record.type === 'summary' && record.summary.trim() && !acc.getNativeSummary()) {
		acc.setNativeSummary(record.summary.trim());
		return;
	}

	if (record.type === 'last-prompt' && record.lastPrompt.trim()) {
		acc.setLastPrompt(truncate(record.lastPrompt.trim()));
	}
}

function extractContentFromRecord(record: ClaudeSessionRecord, acc: ContentAccumulator): void {
	if (extractUserContent(record, acc)) return;
	if (extractAssistantContent(record, acc)) return;
	extractMetadataContent(record, acc);
}

export function extractSessionEntry(
	descriptor: SessionFileDescriptor,
	records: ParsedSessionRecord[],
	fileStat: { mtimeMs: number; mtime: Date; birthtime: Date }
): SessionEntry | null {
	const { created, modified, gitBranch } = extractTimestamps(records);
	const { firstPrompt, lastPrompt, customTitle, nativeSummary, messageCount } =
		extractContent(records);

	const summary = customTitle || summarizeNativeSummary(nativeSummary);
	const resolvedPrompt = firstPrompt || lastPrompt;
	const shouldInclude = Boolean(summary || resolvedPrompt || messageCount > 0);
	if (!shouldInclude) return null;

	return {
		sessionId: descriptor.routeId,
		displaySessionId: descriptor.sessionId,
		fullPath: descriptor.fullPath,
		relativePath: descriptor.relativePath,
		fileMtime: fileStat.mtimeMs,
		firstPrompt: resolvedPrompt,
		summary,
		messageCount,
		created: created || fileStat.birthtime.toISOString(),
		modified: modified || fileStat.mtime.toISOString(),
		gitBranch,
		projectPath: descriptor.relativePath,
		isSidechain: false,
		isSubagent: descriptor.isSubagent,
		parentSessionId: descriptor.parentSessionId,
		customTitle: customTitle || undefined,
		nativeSummary: nativeSummary || undefined,
		lastPrompt: lastPrompt || undefined
	};
}

function summarizeNativeSummary(summary: string): string {
	if (!summary) return '';

	const firstNonEmptyLine = summary
		.split('\n')
		.map((line) => line.trim())
		.find(Boolean);

	if (firstNonEmptyLine) {
		return truncate(firstNonEmptyLine);
	}

	return truncate(summary.replace(/\s+/g, ' ').trim());
}

function truncate(value: string, maxLength = MAX_PROMPT_PREVIEW_LENGTH): string {
	return value.length > maxLength ? value.slice(0, maxLength) : value;
}

import type { SessionEntry } from '../types.js';
import {
	extractTextFromMessageContent,
	isAssistantRecord,
	isUserRecord
} from './session-schema.js';
import type { ParsedSessionRecord } from './session-schema.js';
import type { SessionFileDescriptor } from './session-discovery.js';

export function extractSessionEntry(
	descriptor: SessionFileDescriptor,
	records: ParsedSessionRecord[],
	fileStat: { mtimeMs: number; mtime: Date; birthtime: Date }
): SessionEntry | null {
	let firstPrompt = '';
	let lastPrompt = '';
	let customTitle = '';
	let nativeSummary = '';
	let created = '';
	let modified = '';
	let gitBranch = '';
	let messageCount = 0;
	const seenAssistantMessages = new Set<string>();

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

		if (isUserRecord(record)) {
			messageCount += 1;
			const text = extractTextFromMessageContent(record.message.content).trim();
			if (text && !firstPrompt) {
				firstPrompt = truncate(text);
			}
			if (text) {
				lastPrompt = truncate(text);
			}
			continue;
		}

		if (isAssistantRecord(record)) {
			const assistantMessageKey = record.message.id || record.uuid;
			if (!seenAssistantMessages.has(assistantMessageKey)) {
				seenAssistantMessages.add(assistantMessageKey);
				messageCount += 1;
			}
			continue;
		}

		if (record.type === 'custom-title' && record.customTitle.trim() && !customTitle) {
			customTitle = record.customTitle.trim();
			continue;
		}

		if (record.type === 'summary' && record.summary.trim() && !nativeSummary) {
			nativeSummary = record.summary.trim();
			continue;
		}

		if (record.type === 'last-prompt' && record.lastPrompt.trim()) {
			lastPrompt = truncate(record.lastPrompt.trim());
		}
	}

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

function truncate(value: string, maxLength = 200): string {
	return value.length > maxLength ? value.slice(0, maxLength) : value;
}

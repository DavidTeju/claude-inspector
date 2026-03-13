import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';

const fixturesRoot = path.join(process.cwd(), 'tests', 'fixtures', 'projects');

interface SessionFileDescriptor {
	fullPath: string;
	routeId: string;
	isSubagent: boolean;
	parentSessionId?: string;
}

interface ParsedSessionRecord {
	record: SessionRecord;
}

interface SessionRecord {
	type: string;
	message?: {
		id?: string;
		usage?: unknown;
	};
}

interface AssistantRecord extends SessionRecord {
	type: 'assistant';
	message: {
		id: string;
		usage?: unknown;
	};
}

interface ThreadMessage {
	toolCalls: Array<{ name?: string }>;
	thinkingBlocks: string[];
}

interface SessionEntry {
	summary: string;
	customTitle?: string;
	nativeSummary?: string;
	lastPrompt?: string;
	messageCount: number;
}

interface SessionAdaptersModule {
	toThreadMessages(records: ParsedSessionRecord[]): ThreadMessage[];
}

interface SessionDiscoveryModule {
	listProjectSessionFilesInDir(
		projectId: string,
		projectDir: string
	): Promise<SessionFileDescriptor[]>;
}

interface SessionMetadataModule {
	extractSessionEntry(
		descriptor: SessionFileDescriptor,
		records: ParsedSessionRecord[],
		fileStat: Awaited<ReturnType<typeof stat>>
	): SessionEntry | null;
}

interface SessionParserModule {
	parseSessionFile(filePath: string): Promise<ParsedSessionRecord[]>;
}

interface SessionSchemaModule {
	isAssistantRecord(record: SessionRecord): record is AssistantRecord;
}

const vite = await createServer({
	appType: 'custom',
	optimizeDeps: {
		noDiscovery: true
	},
	server: {
		middlewareMode: true
	}
});

const [
	{ toThreadMessages },
	{ listProjectSessionFilesInDir },
	{ extractSessionEntry },
	{ parseSessionFile },
	{ isAssistantRecord }
] = (await Promise.all([
	vite.ssrLoadModule('/src/lib/server/session-adapters.ts'),
	vite.ssrLoadModule('/src/lib/server/session-discovery.ts'),
	vite.ssrLoadModule('/src/lib/server/session-metadata.ts'),
	vite.ssrLoadModule('/src/lib/server/session-parser.ts'),
	vite.ssrLoadModule('/src/lib/server/session-schema.ts')
])) as [
	SessionAdaptersModule,
	SessionDiscoveryModule,
	SessionMetadataModule,
	SessionParserModule,
	SessionSchemaModule
];

try {
	await validateBasicProject();
	await validateMetadataProject();
	await validateProgressProject();
	await validateFileHistoryProject();
	await validateChunkedProject();
	await validateSubagentProject();
	await validateCorruptProject();

	console.log('session fixture validation passed');
} finally {
	await vite.close();
}

async function validateBasicProject(): Promise<void> {
	const descriptor = await getSingleDescriptor('basic-project');
	const records = await parseSessionFile(descriptor.fullPath);
	const messages = toThreadMessages(records);

	assert.equal(messages.length, 2);
	assert.equal(messages[1]?.toolCalls.length, 1);
	assert.equal(messages[1]?.thinkingBlocks.length, 1);
	assert.equal(messages[1]?.toolCalls[0]?.name, 'Read');
}

async function validateMetadataProject(): Promise<void> {
	const descriptor = await getSingleDescriptor('metadata-project');
	const records = await parseSessionFile(descriptor.fullPath);
	const fileStat = await stat(descriptor.fullPath);
	const entry = extractSessionEntry(descriptor, records, fileStat);

	assert.ok(entry);
	assert.equal(entry.summary, 'Native Titles Win');
	assert.equal(entry.customTitle, 'Native Titles Win');
	assert.equal(
		entry.nativeSummary,
		'This session migrated the parser.\nIt kept the UI adapter intact.'
	);
	assert.equal(entry.lastPrompt, 'Refactor the raw schema handling.');
}

async function validateProgressProject(): Promise<void> {
	const descriptor = await getSingleDescriptor('progress-project');
	const records = await parseSessionFile(descriptor.fullPath);

	assert.ok(records.some(({ record }) => record.type === 'progress'));
	assert.ok(records.some(({ record }) => record.type === 'system'));
}

async function validateFileHistoryProject(): Promise<void> {
	const descriptor = await getSingleDescriptor('file-history-project');
	const records = await parseSessionFile(descriptor.fullPath);

	assert.ok(records.some(({ record }) => record.type === 'file-history-snapshot'));
}

async function validateChunkedProject(): Promise<void> {
	const descriptor = await getSingleDescriptor('chunked-project');
	const records = await parseSessionFile(descriptor.fullPath);
	const fileStat = await stat(descriptor.fullPath);
	const entry = extractSessionEntry(descriptor, records, fileStat);
	const assistantRecords = records
		.map(({ record }) => record)
		.filter(
			(record): record is AssistantRecord =>
				isAssistantRecord(record) && record.message.id === 'msg_chunked_1'
		);
	const finalAssistant = assistantRecords[assistantRecords.length - 1];

	assert.equal(assistantRecords.length, 2);
	assert.ok(finalAssistant?.message.usage);
	assert.ok(entry);
	assert.equal(entry.messageCount, 2);
}

async function validateSubagentProject(): Promise<void> {
	const projectDir = path.join(fixturesRoot, 'subagent-project');
	const descriptors = await listProjectSessionFilesInDir('subagent-project', projectDir);
	const routeIds = descriptors.map((descriptor) => descriptor.routeId).sort();
	const childDescriptor = descriptors.find((descriptor) => descriptor.isSubagent);

	assert.deepEqual(routeIds, ['parent-session', 'parent-session~subagent~agent-child-session']);
	assert.ok(childDescriptor);
	assert.equal(childDescriptor.parentSessionId, 'parent-session');
}

async function validateCorruptProject(): Promise<void> {
	const descriptor = await getSingleDescriptor('corrupt-project');
	const records = await parseSessionFile(descriptor.fullPath);

	assert.equal(records.length, 2);
}

async function getSingleDescriptor(projectId: string) {
	const projectDir = path.join(fixturesRoot, projectId);
	const descriptors = await listProjectSessionFilesInDir(projectId, projectDir);

	assert.equal(descriptors.length, 1);
	return descriptors[0];
}

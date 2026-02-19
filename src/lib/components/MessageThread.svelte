<script lang="ts">
	import UserMessage from './UserMessage.svelte';
	import AssistantMessage from './AssistantMessage.svelte';

	let {
		messages
	}: {
		messages: Array<{
			uuid: string;
			role: 'user' | 'assistant';
			timestamp: string;
			textContent: string;
			toolCalls: Array<{
				id: string;
				name: string;
				input: Record<string, unknown>;
				result?: string | Array<{ type: string; text?: string }>;
				isError?: boolean;
			}>;
			thinkingBlocks: string[];
			rawContent: string | Array<{ type: string; text?: string }>;
			model?: string;
		}>;
	} = $props();
</script>

<div class="space-y-4">
	{#each messages as message (message.uuid)}
		{#if message.role === 'user'}
			<UserMessage {message} />
		{:else}
			<AssistantMessage {message} />
		{/if}
	{/each}
</div>

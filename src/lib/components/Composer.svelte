<script lang="ts">
	import type { SlashCommand } from '$lib/shared/active-session-types.js';

	const DRAFT_SAVE_DEBOUNCE_MS = 500;
	const MIN_TEXTAREA_HEIGHT = 44;
	const MAX_TEXTAREA_HEIGHT = 200;
	const MAX_VISIBLE_COMMANDS = 8;

	let {
		onSubmit,
		disabled = false,
		placeholder = 'Send a message...',
		draftKey = 'composer-draft',
		suggestion = '',
		isQueuing = false,
		buttonLabel = '',
		slashCommands = []
	}: {
		onSubmit: (text: string) => void;
		disabled?: boolean;
		placeholder?: string;
		draftKey?: string;
		suggestion?: string;
		isQueuing?: boolean;
		buttonLabel?: string;
		slashCommands?: SlashCommand[];
	} = $props();

	let resolvedButtonLabel = $derived(buttonLabel || (isQueuing ? 'Queue' : 'Send'));

	let text = $state('');
	let textareaEl: HTMLTextAreaElement | undefined = $state();
	let selectedIndex = $state(0);

	// Slash command autocomplete: active when text starts with "/" and has available commands
	let slashQuery = $derived(
		text.startsWith('/') && !text.includes(' ') && !text.includes('\n') ? text.slice(1) : null
	);

	let filteredCommands = $derived.by(() => {
		if (slashQuery === null || slashCommands.length === 0) return [];
		const q = slashQuery.toLowerCase();
		return slashCommands
			.filter((cmd) => cmd.name.toLowerCase().startsWith(q))
			.slice(0, MAX_VISIBLE_COMMANDS);
	});

	let showCommandList = $derived(filteredCommands.length > 0 && slashQuery !== null);

	// Ghost text: show the completion of the top match
	let ghostText = $derived.by(() => {
		if (!showCommandList || filteredCommands.length === 0) return '';
		const match = filteredCommands[selectedIndex] ?? filteredCommands[0];
		if (!match) return '';
		const remaining = match.name.slice(slashQuery!.length);
		if (!remaining) return '';
		const hint = match.argumentHint ? ` ${match.argumentHint}` : '';
		return remaining + hint;
	});

	// Reset selected index when filtered commands change
	$effect(() => {
		void filteredCommands;
		selectedIndex = 0;
	});

	// Load draft then persist changes — single effect avoids mount race
	let draftInitialized = false;
	let draftTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		if (typeof window === 'undefined') return;
		if (!draftInitialized) {
			const draft = localStorage.getItem(draftKey);
			if (draft) text = draft;
			draftInitialized = true;
			return;
		}
		const currentText = text;
		clearTimeout(draftTimer);
		draftTimer = setTimeout(() => {
			if (currentText) {
				localStorage.setItem(draftKey, currentText);
			} else {
				localStorage.removeItem(draftKey);
			}
		}, DRAFT_SAVE_DEBOUNCE_MS);
		return () => clearTimeout(draftTimer);
	});

	// Auto-resize textarea whenever text changes
	$effect(() => {
		if (!textareaEl || (!text && text !== '')) return;
		textareaEl.style.height = 'auto';
		textareaEl.style.height = `${Math.min(Math.max(textareaEl.scrollHeight, MIN_TEXTAREA_HEIGHT), MAX_TEXTAREA_HEIGHT)}px`;
	});

	function acceptCommand(cmd: SlashCommand) {
		text = `/${cmd.name} `;
		textareaEl?.focus();
	}

	function handleKeydown(e: KeyboardEvent) {
		// Command list navigation
		if (showCommandList) {
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				selectedIndex =
					selectedIndex <= 0 ? filteredCommands.length - 1 : selectedIndex - 1;
				return;
			}
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				selectedIndex =
					selectedIndex >= filteredCommands.length - 1 ? 0 : selectedIndex + 1;
				return;
			}
			if (e.key === 'Tab') {
				e.preventDefault();
				const cmd = filteredCommands[selectedIndex] ?? filteredCommands[0];
				if (cmd) acceptCommand(cmd);
				return;
			}
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				const cmd = filteredCommands[selectedIndex] ?? filteredCommands[0];
				if (cmd) acceptCommand(cmd);
				return;
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				text = '';
				return;
			}
		}

		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			submit();
		}

		if (e.key === 'Tab' && suggestion && !text.trim()) {
			e.preventDefault();
			text = suggestion;
		}
	}

	function submit() {
		const trimmed = text.trim();
		if (!trimmed || disabled) return;
		onSubmit(trimmed);
		text = '';
		localStorage.removeItem(draftKey);
	}

	let canSubmit = $derived(!disabled && text.trim().length > 0);
</script>

<div class="border-surface-800 bg-surface-900/50 rounded-xl border">
	<div class="relative">
		<!-- Slash command popup (above the textarea) -->
		{#if showCommandList}
			<div
				class="border-surface-700 bg-surface-900 absolute bottom-full left-0 z-20 mb-1 w-full overflow-hidden rounded-lg border shadow-lg"
				role="listbox"
				aria-label="Slash commands"
			>
				{#each filteredCommands as cmd, i (cmd.name)}
					<button
						role="option"
						aria-selected={i === selectedIndex}
						class="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm transition-colors {i ===
						selectedIndex
							? 'bg-accent-500/15 text-text-100'
							: 'text-text-300 hover:bg-surface-800'}"
						onmouseenter={() => (selectedIndex = i)}
						onclick={() => acceptCommand(cmd)}
					>
						<span class="text-accent-400 font-medium">/{cmd.name}</span>
						{#if cmd.argumentHint}
							<span class="text-text-600 text-xs">{cmd.argumentHint}</span>
						{/if}
						<span class="text-text-500 ml-auto truncate text-xs">{cmd.description}</span>
					</button>
				{/each}
			</div>
		{/if}

		<textarea
			bind:this={textareaEl}
			bind:value={text}
			onkeydown={handleKeydown}
			{placeholder}
			{disabled}
			rows="1"
			class="text-text-100 placeholder-text-500 w-full resize-none bg-transparent px-4 py-3.5 text-base focus:outline-none disabled:opacity-40 supports-[field-sizing:content]:field-sizing-content"
			style="min-height: 48px; max-height: 200px;"
		></textarea>

		<!-- Ghost text for slash command completion -->
		{#if ghostText}
			<div class="pointer-events-none absolute top-3.5 left-4 text-base">
				<span class="invisible">{text}</span><span class="text-text-700">{ghostText}</span>
				<span class="border-surface-700 text-text-500 ml-1 rounded border px-1 py-0.5 text-[10px]"
					>Tab</span
				>
			</div>
		{:else if suggestion && !text.trim()}
			<div class="text-text-700 pointer-events-none absolute top-3.5 left-4 text-base">
				{suggestion}
				<span class="border-surface-700 text-text-500 ml-2 rounded border px-1 py-0.5 text-[10px]"
					>Tab</span
				>
			</div>
		{/if}
	</div>

	<div class="border-surface-800/50 flex items-center justify-between border-t px-3 py-2.5">
		<span class="text-text-700 text-[11px]">
			{#if isQueuing}
				Message will be queued
			{:else}
				Shift+Enter for new line
			{/if}
		</span>

		<button
			onclick={submit}
			disabled={!canSubmit}
			aria-label={isQueuing ? 'Queue message' : 'Send message'}
			class="rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors {isQueuing
				? 'border-warning-500/30 bg-warning-500/20 text-warning-500 border'
				: 'bg-accent-500 text-surface-950'} {!canSubmit
				? 'cursor-not-allowed opacity-40'
				: 'cursor-pointer'}"
		>
			{resolvedButtonLabel}
		</button>
	</div>
</div>

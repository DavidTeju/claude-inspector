<script lang="ts">
	import type { SlashCommand } from '$lib/shared/active-session-types.js';

	const DRAFT_SAVE_DEBOUNCE_MS = 500;
	const MIN_TEXTAREA_HEIGHT = 36;
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
	let measureEl: HTMLSpanElement | undefined = $state();
	let selectedIndex = $state(0);
	let dismissed = $state(false);
	let caretLeftPx = $state(0);

	// Slash command autocomplete: active when text starts with "/" and has available commands
	let slashQuery = $derived(
		text.startsWith('/') && !text.includes(' ') && !text.includes('\n') ? text.slice(1) : null
	);

	// Reset dismissed flag when the query changes (user types more)
	$effect(() => {
		void slashQuery;
		dismissed = false;
	});

	// Copy textarea font to the hidden measurement span once mounted
	$effect(() => {
		if (!measureEl || !textareaEl) return;
		const style = getComputedStyle(textareaEl);
		measureEl.style.font = style.font;
		measureEl.style.letterSpacing = style.letterSpacing;
	});

	// Measure caret position whenever slash query text changes.
	// The span's content is set via template binding; offsetWidth is a plain DOM
	// property (not tracked by Svelte), so we depend on `text` explicitly.
	$effect(() => {
		if (!measureEl || slashQuery === null) return;
		void text;
		caretLeftPx = measureEl.offsetWidth;
	});

	let filteredCommands = $derived.by(() => {
		if (slashQuery === null || slashCommands.length === 0) return [];
		const q = slashQuery.toLowerCase();
		return slashCommands
			.filter((cmd) => cmd.name.toLowerCase().startsWith(q))
			.slice(0, MAX_VISIBLE_COMMANDS);
	});

	let showCommandList = $derived(filteredCommands.length > 0 && slashQuery !== null && !dismissed);

	// Ghost text: show the completion of the top match
	let effectiveIndex = $derived(selectedIndex < filteredCommands.length ? selectedIndex : 0);

	let ghostText = $derived.by(() => {
		if (!showCommandList || filteredCommands.length === 0) return '';
		const match = filteredCommands[effectiveIndex];
		if (!match) return '';
		const remaining = match.name.slice(slashQuery?.length ?? 0);
		if (!remaining) return '';
		const hint = match.argumentHint ? ` ${match.argumentHint}` : '';
		return remaining + hint;
	});

	// Load draft then persist changes — single effect avoids mount race
	let draftInitialized = false;
	let lastDraftKey = draftKey;
	let draftTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		if (typeof window === 'undefined') return;
		if (!draftInitialized || lastDraftKey !== draftKey) {
			lastDraftKey = draftKey;
			const draft = localStorage.getItem(draftKey);
			text = draft ?? '';
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

	function handleCommandListKeydown(e: KeyboardEvent): boolean {
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedIndex = selectedIndex <= 0 ? filteredCommands.length - 1 : selectedIndex - 1;
			return true;
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedIndex = selectedIndex >= filteredCommands.length - 1 ? 0 : selectedIndex + 1;
			return true;
		}
		if (e.key === 'Tab') {
			e.preventDefault();
			const cmd = filteredCommands[effectiveIndex];
			if (cmd) acceptCommand(cmd);
			return true;
		}
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			const cmd = filteredCommands[effectiveIndex];
			if (cmd) acceptCommand(cmd);
			return true;
		}
		if (e.key === 'Escape') {
			e.preventDefault();
			dismissed = true;
			return true;
		}
		return false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (showCommandList && handleCommandListKeydown(e)) return;

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
		<!-- Slash command popup (above the textarea, follows cursor) -->
		{#if showCommandList}
			<div
				class="border-surface-700 bg-surface-900 absolute bottom-full z-20 mb-1 max-w-xs overflow-hidden rounded-lg border shadow-lg"
				style="left: {caretLeftPx}px;"
				id="slash-command-listbox"
				role="listbox"
				aria-label="Slash commands"
			>
				{#each filteredCommands as cmd, i (cmd.name)}
					<button
						id="slash-cmd-{i}"
						role="option"
						aria-selected={i === effectiveIndex}
						class="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-xs transition-colors {i ===
						effectiveIndex
							? 'bg-accent-500/15 text-text-100'
							: 'text-text-300 hover:bg-surface-800'}"
						onmouseenter={() => (selectedIndex = i)}
						onclick={() => acceptCommand(cmd)}
					>
						<span class="text-accent-400 shrink-0 font-medium">/{cmd.name}</span>
						{#if cmd.argumentHint}
							<span class="text-text-600 shrink-0">{cmd.argumentHint}</span>
						{/if}
						<span class="text-text-500 ml-auto truncate">{cmd.description}</span>
					</button>
				{/each}
			</div>
		{/if}

		<!-- Hidden span to measure caret position -->
		<span
			bind:this={measureEl}
			class="pointer-events-none invisible absolute top-0 left-4 text-sm whitespace-pre"
			aria-hidden="true">{text}</span
		>

		<textarea
			bind:this={textareaEl}
			bind:value={text}
			onkeydown={handleKeydown}
			{placeholder}
			{disabled}
			rows="1"
			role="combobox"
			aria-controls="slash-command-listbox"
			aria-expanded={showCommandList}
			aria-activedescendant={showCommandList ? `slash-cmd-${effectiveIndex}` : undefined}
			class="text-text-100 placeholder-text-500 w-full resize-none bg-transparent px-4 py-2.5 text-sm focus:outline-none disabled:opacity-40 supports-[field-sizing:content]:field-sizing-content"
			style="min-height: 36px; max-height: 200px;"
		></textarea>

		<!-- Ghost text for slash command completion -->
		{#if ghostText}
			<div class="pointer-events-none absolute top-2.5 left-4 text-sm">
				<span class="invisible">{text}</span><span class="text-text-700">{ghostText}</span>
				<span class="border-surface-700 text-text-500 ml-1 rounded border px-1 py-0.5 text-[10px]"
					>Tab</span
				>
			</div>
		{:else if suggestion && !text.trim()}
			<div class="text-text-700 pointer-events-none absolute top-2.5 left-4 text-sm">
				{suggestion}
				<span class="border-surface-700 text-text-500 ml-2 rounded border px-1 py-0.5 text-[10px]"
					>Tab</span
				>
			</div>
		{/if}
	</div>

	<div class="border-surface-800/50 flex items-center justify-between border-t px-3 py-1.5">
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

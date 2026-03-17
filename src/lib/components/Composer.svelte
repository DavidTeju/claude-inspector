<script lang="ts">
	const DRAFT_SAVE_DEBOUNCE_MS = 500;
	const MIN_TEXTAREA_HEIGHT = 36;
	const MAX_TEXTAREA_HEIGHT = 200;

	let {
		onSubmit,
		disabled = false,
		placeholder = 'Send a message...',
		draftKey = 'composer-draft',
		suggestion = '',
		isQueuing = false,
		buttonLabel = ''
	}: {
		onSubmit: (text: string) => void;
		disabled?: boolean;
		placeholder?: string;
		draftKey?: string;
		suggestion?: string;
		isQueuing?: boolean;
		buttonLabel?: string;
	} = $props();

	let resolvedButtonLabel = $derived(buttonLabel || (isQueuing ? 'Queue' : 'Send'));

	let text = $state('');
	let textareaEl: HTMLTextAreaElement | undefined = $state();

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

	function handleKeydown(e: KeyboardEvent) {
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
		<textarea
			bind:this={textareaEl}
			bind:value={text}
			onkeydown={handleKeydown}
			{placeholder}
			{disabled}
			rows="1"
			class="text-text-100 placeholder-text-500 w-full resize-none bg-transparent px-4 py-2.5 text-sm focus:outline-none disabled:opacity-40 supports-[field-sizing:content]:field-sizing-content"
			style="min-height: 36px; max-height: 200px;"
		></textarea>

		{#if suggestion && !text.trim()}
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

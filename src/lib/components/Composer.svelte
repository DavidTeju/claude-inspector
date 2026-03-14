<script lang="ts">
	let {
		onSubmit,
		disabled = false,
		placeholder = 'Send a message...',
		draftKey = 'composer-draft',
		suggestion = '',
		isQueuing = false
	}: {
		onSubmit: (text: string) => void;
		disabled?: boolean;
		placeholder?: string;
		draftKey?: string;
		suggestion?: string;
		isQueuing?: boolean;
	} = $props();

	let text = $state('');
	let textareaEl: HTMLTextAreaElement | undefined = $state();

	// Load draft from localStorage on mount
	$effect(() => {
		if (typeof window !== 'undefined') {
			const draft = localStorage.getItem(draftKey);
			if (draft) text = draft;
		}
	});

	// Auto-resize textarea
	$effect(() => {
		if (!textareaEl) return;
		// Access text to create dependency
		void text;
		textareaEl.style.height = 'auto';
		textareaEl.style.height = `${Math.min(Math.max(textareaEl.scrollHeight, 44), 200)}px`;
	});

	// Persist draft to localStorage (debounced)
	let draftTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		if (typeof window === 'undefined') return;
		const currentText = text;
		clearTimeout(draftTimer);
		draftTimer = setTimeout(() => {
			if (currentText) {
				localStorage.setItem(draftKey, currentText);
			} else {
				localStorage.removeItem(draftKey);
			}
		}, 500);
		return () => clearTimeout(draftTimer);
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
			class="text-text-100 placeholder-text-500 w-full resize-none bg-transparent px-4 py-3 text-sm focus:outline-none disabled:opacity-40"
			style="min-height: 44px; max-height: 200px;"
		></textarea>

		{#if suggestion && !text.trim()}
			<div class="text-text-700 pointer-events-none absolute top-3 left-4 text-sm">
				{suggestion}
				<span class="border-surface-700 text-text-500 ml-2 rounded border px-1 py-0.5 text-[9px]"
					>Tab</span
				>
			</div>
		{/if}
	</div>

	<div class="border-surface-800/50 flex items-center justify-between border-t px-3 py-2">
		<span class="text-text-700 text-[10px]">
			{#if isQueuing}
				Message will be queued
			{:else}
				Shift+Enter for new line
			{/if}
		</span>

		<button
			onclick={submit}
			disabled={!canSubmit}
			class="rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors {isQueuing
				? 'border border-amber-500/30 bg-amber-500/20 text-amber-300'
				: 'bg-accent-500 text-surface-950'} {!canSubmit
				? 'cursor-not-allowed opacity-40'
				: 'cursor-pointer'}"
		>
			{isQueuing ? 'Queue' : 'Send'}
		</button>
	</div>
</div>

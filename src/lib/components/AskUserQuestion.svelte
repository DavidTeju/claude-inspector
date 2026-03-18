<script lang="ts">
	import type { AskUserQuestionRequest } from '$lib/shared/active-session-types.js';

	const OTHER_SENTINEL = '__other__';

	let {
		request,
		onSubmit
	}: {
		request: AskUserQuestionRequest;
		onSubmit: (answers: Record<string, string | string[]>) => void;
	} = $props();

	let answers = $state<Record<number, string | string[]>>({});
	let otherTexts = $state<Record<number, string>>({});

	// Pagination state
	let currentPage = $state(0);
	let totalPages = $derived(request.questions.length);
	let isSingleQuestion = $derived(totalPages === 1);
	let isFirstPage = $derived(currentPage === 0);
	let isLastPage = $derived(currentPage === totalPages - 1);
	let currentQuestion = $derived(request.questions[currentPage]);

	function goNext() {
		if (currentPage < totalPages - 1) currentPage++;
	}

	function goPrev() {
		if (currentPage > 0) currentPage--;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (isSingleQuestion) return;
		// Only handle arrow keys when focus is not inside an option control or text input
		const target = e.target as HTMLElement;
		const insideControl =
			target.closest('[role="radiogroup"]') ||
			target.closest('[role="group"]') ||
			target.tagName === 'INPUT';
		if (insideControl) return;

		if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
			e.preventDefault();
			goNext();
		} else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
			e.preventDefault();
			goPrev();
		}
	}

	function selectSingle(questionIdx: number, value: string) {
		answers[questionIdx] = value;
	}

	function toggleMulti(questionIdx: number, value: string) {
		const current = (answers[questionIdx] as string[] | undefined) ?? [];
		if (current.includes(value)) {
			answers[questionIdx] = current.filter((v) => v !== value);
		} else {
			answers[questionIdx] = [...current, value];
		}
	}

	function isSelected(questionIdx: number, value: string): boolean {
		const answer = answers[questionIdx];
		if (Array.isArray(answer)) return answer.includes(value);
		return answer === value;
	}

	function resolveAnswer(
		answer: string | string[] | undefined,
		otherText: string | undefined,
		multiSelect: boolean
	): string | string[] | undefined {
		if (multiSelect && Array.isArray(answer)) {
			if (answer.includes(OTHER_SENTINEL)) {
				const filtered = answer.filter((v) => v !== OTHER_SENTINEL);
				return otherText ? [...filtered, otherText] : filtered;
			}
			return answer;
		}
		if (answer === OTHER_SENTINEL) return otherText ?? '';
		return answer;
	}

	function handleSubmit() {
		const result: Record<string, string | string[]> = {};
		for (let i = 0; i < request.questions.length; i++) {
			const q = request.questions[i];
			const otherText = otherTexts[i]?.trim();
			const answer = resolveAnswer(answers[i], otherText, q.multiSelect ?? false);

			if (
				answer !== undefined &&
				answer !== '' &&
				!(Array.isArray(answer) && answer.length === 0)
			) {
				result[q.question] = answer;
			}
		}
		onSubmit(result);
	}

	let hasAnyAnswer = $derived(
		request.questions.some((q, i) => {
			const answer = answers[i];
			const otherText = otherTexts[i]?.trim();
			if (Array.isArray(answer)) {
				const nonOtherCount = answer.filter((v) => v !== OTHER_SENTINEL).length;
				if (nonOtherCount > 0) return true;
				return answer.includes(OTHER_SENTINEL) && !!otherText;
			}
			if (answer === OTHER_SENTINEL) return !!otherText;
			return answer !== undefined && answer !== '';
		})
	);
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="border-l-user-400 bg-user-700/10 rounded-xl border-l-2 px-4 py-3">
	<!-- Progress indicator for multi-question -->
	{#if !isSingleQuestion}
		<div class="text-text-500 mb-2 flex items-center gap-2 text-[11px]">
			<span>{currentPage + 1} / {totalPages}</span>
			<div class="flex gap-1">
				{#each request.questions as _, i (i)}
					<span
						class="inline-block h-1.5 w-1.5 rounded-full transition-colors {i === currentPage
							? 'bg-user-400'
							: 'bg-surface-700'}"
					></span>
				{/each}
			</div>
		</div>
	{/if}

	<div>
		{#if currentQuestion.header}
			<div class="text-text-100 mb-1 text-[11px] font-semibold">{currentQuestion.header}</div>
		{/if}
		<div class="text-text-300 mb-2 text-sm">{currentQuestion.question}</div>

		<div class="flex flex-wrap gap-1.5" role={currentQuestion.multiSelect ? 'group' : 'radiogroup'}>
			{#each currentQuestion.options as option (option.label)}
				{@const value = option.value ?? option.label}
				{@const selected = isSelected(currentPage, value)}
				<button
					onclick={() =>
						currentQuestion.multiSelect
							? toggleMulti(currentPage, value)
							: selectSingle(currentPage, value)}
					role={currentQuestion.multiSelect ? 'checkbox' : 'radio'}
					aria-checked={selected}
					class="cursor-pointer rounded-full border px-3.5 py-1.5 text-sm transition-all {selected
						? 'border-user-400 bg-user-400/15 text-user-400 shadow-sm'
						: 'border-surface-700 text-text-300 hover:border-surface-600 hover:bg-surface-800/40'}"
				>
					{option.label}
					{#if option.description}
						<span class="text-text-500 ml-0.5 text-[10px]">{option.description}</span>
					{/if}
				</button>
			{/each}

			<!-- Other option — only for non-binary questions -->
			{#if currentQuestion.options.length > 2}
				{@const otherSelected = isSelected(currentPage, OTHER_SENTINEL)}
				<button
					onclick={() =>
						currentQuestion.multiSelect
							? toggleMulti(currentPage, OTHER_SENTINEL)
							: selectSingle(currentPage, OTHER_SENTINEL)}
					role={currentQuestion.multiSelect ? 'checkbox' : 'radio'}
					aria-checked={otherSelected}
					class="flex cursor-pointer items-center gap-1 rounded-full border px-3.5 py-1.5 text-sm transition-all {otherSelected
						? 'border-user-400 bg-user-400/15 text-user-400 shadow-sm'
						: 'border-surface-700 text-text-300 hover:border-surface-600 hover:bg-surface-800/40'}"
				>
					<input
						type="text"
						bind:value={otherTexts[currentPage]}
						placeholder="Other..."
						onclick={(e) => {
							e.stopPropagation();
							if (!otherSelected) {
								if (currentQuestion.multiSelect) {
									toggleMulti(currentPage, OTHER_SENTINEL);
								} else {
									selectSingle(currentPage, OTHER_SENTINEL);
								}
							}
						}}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.stopPropagation();
								e.preventDefault();
							}
						}}
						class="w-16 min-w-0 bg-transparent text-sm focus:outline-none {otherSelected
							? 'text-text-100 placeholder-text-500 cursor-text'
							: 'text-text-500 cursor-pointer line-through'}"
					/>
				</button>
			{/if}
		</div>
	</div>

	<!-- Navigation and submit controls -->
	<div class="mt-3 flex items-center gap-2">
		{#if !isSingleQuestion}
			<button
				onclick={goPrev}
				disabled={isFirstPage}
				aria-label="Previous question"
				class="rounded-lg border px-2 py-2 text-[11px] transition-colors {isFirstPage
					? 'border-surface-800 text-surface-700 cursor-not-allowed'
					: 'border-surface-700 text-text-300 hover:bg-surface-800/50 cursor-pointer'}"
			>
				<svg
					class="h-3.5 w-3.5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
			</button>
		{/if}

		{#if isSingleQuestion || isLastPage}
			<button
				onclick={handleSubmit}
				disabled={!hasAnyAnswer}
				class="bg-user-500 text-surface-950 rounded-lg px-4 py-2 text-[11px] font-semibold transition-colors {hasAnyAnswer
					? 'hover:bg-user-400 cursor-pointer'
					: 'cursor-not-allowed opacity-40'}"
			>
				Submit
			</button>
		{:else}
			<button
				onclick={goNext}
				aria-label="Next question"
				class="bg-user-500 text-surface-950 hover:bg-user-400 cursor-pointer rounded-lg px-4 py-2 text-[11px] font-semibold transition-colors"
			>
				Next
			</button>
		{/if}

		{#if !isSingleQuestion}
			<button
				onclick={goNext}
				disabled={isLastPage}
				aria-label="Next question"
				class="rounded-lg border px-2 py-2 text-[11px] transition-colors {isLastPage
					? 'border-surface-800 text-surface-700 cursor-not-allowed'
					: 'border-surface-700 text-text-300 hover:bg-surface-800/50 cursor-pointer'}"
			>
				<svg
					class="h-3.5 w-3.5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
				</svg>
			</button>
		{/if}
	</div>
</div>

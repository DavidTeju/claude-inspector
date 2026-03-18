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

	function dotColor(i: number): string {
		if (i === currentPage) return 'bg-user-400';
		if (i < currentPage) return 'bg-user-400/40';
		return 'bg-surface-700';
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Card stack container -->
<div class="relative">
	<!-- Background "stacked" cards for depth effect (multi-question only) -->
	{#if !isSingleQuestion}
		{#if totalPages - currentPage > 2}
			<div
				class="bg-surface-900 border-surface-800 pointer-events-none absolute top-3 right-1 left-1 h-8 rounded-xl border opacity-40"
			></div>
		{/if}
		{#if totalPages - currentPage > 1}
			<div
				class="bg-surface-900 border-surface-800/70 pointer-events-none absolute top-1.5 right-0.5 left-0.5 h-8 rounded-xl border opacity-60"
			></div>
		{/if}
	{/if}

	<!-- Active card -->
	<div class="border-surface-800 bg-surface-900 relative rounded-xl border px-5 py-4 shadow-md">
		<!-- Progress -->
		{#if !isSingleQuestion}
			<div class="text-text-500 mb-3 flex items-center justify-between text-[11px]">
				<span class="font-medium">Question {currentPage + 1} of {totalPages}</span>
				<div class="flex gap-1">
					{#each request.questions as _, i (i)}
						<span class="inline-block h-1.5 w-1.5 rounded-full transition-colors {dotColor(i)}"
						></span>
					{/each}
				</div>
			</div>
			<div class="border-surface-800 -mx-5 mb-3 border-t"></div>
		{/if}

		{#if currentQuestion.header}
			<div class="text-user-400 mb-1 text-[11px] font-semibold tracking-wide uppercase">
				{currentQuestion.header}
			</div>
		{/if}
		<div class="text-text-100 mb-3 text-sm font-medium">{currentQuestion.question}</div>

		<div class="space-y-1.5" role={currentQuestion.multiSelect ? 'group' : 'radiogroup'}>
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
					class="flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all {selected
						? 'border-user-400/50 bg-user-700/15 shadow-sm'
						: 'border-surface-700 hover:border-surface-600 hover:bg-surface-800/40'}"
				>
					<span
						class="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-{currentQuestion.multiSelect
							? 'sm'
							: 'full'} border {selected ? 'border-user-400 bg-user-400' : 'border-surface-600'}"
					>
						{#if selected}
							<svg
								class="text-surface-950 h-2.5 w-2.5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="3"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
							</svg>
						{/if}
					</span>

					<div>
						<span class="text-text-100 text-sm">{option.label}</span>
						{#if option.description}
							<span class="text-text-500 ml-1 text-[10px]">{option.description}</span>
						{/if}
					</div>
				</button>
			{/each}

			<!-- Other option -->
			{#if currentQuestion.options.length > 2}
				{@const otherSelected = isSelected(currentPage, OTHER_SENTINEL)}
				<button
					onclick={() =>
						currentQuestion.multiSelect
							? toggleMulti(currentPage, OTHER_SENTINEL)
							: selectSingle(currentPage, OTHER_SENTINEL)}
					role={currentQuestion.multiSelect ? 'checkbox' : 'radio'}
					aria-checked={otherSelected}
					class="flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all {otherSelected
						? 'border-user-400/50 bg-user-700/15 shadow-sm'
						: 'border-surface-700 hover:border-surface-600 hover:bg-surface-800/40'}"
				>
					<span
						class="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-{currentQuestion.multiSelect
							? 'sm'
							: 'full'} border {otherSelected
							? 'border-user-400 bg-user-400'
							: 'border-surface-600'}"
					>
						{#if otherSelected}
							<svg
								class="text-surface-950 h-2.5 w-2.5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="3"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
							</svg>
						{/if}
					</span>

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
						class="min-w-0 flex-1 bg-transparent text-sm focus:outline-none {otherSelected
							? 'text-text-100 placeholder-text-500 cursor-text'
							: 'text-text-500 cursor-pointer line-through'}"
					/>
				</button>
			{/if}
		</div>

		<!-- Navigation -->
		<div class="mt-4 flex items-center justify-between">
			<div>
				{#if !isSingleQuestion && !isFirstPage}
					<button
						onclick={goPrev}
						aria-label="Previous question"
						class="text-text-500 hover:text-text-300 cursor-pointer text-[11px] transition-colors"
					>
						← Back
					</button>
				{/if}
			</div>

			{#if isSingleQuestion || isLastPage}
				<button
					onclick={handleSubmit}
					disabled={!hasAnyAnswer}
					class="bg-user-500 text-surface-950 rounded-lg px-5 py-2 text-[11px] font-semibold transition-colors {hasAnyAnswer
						? 'hover:bg-user-400 cursor-pointer'
						: 'cursor-not-allowed opacity-40'}"
				>
					Submit
				</button>
			{:else}
				<button
					onclick={goNext}
					aria-label="Next question"
					class="bg-user-500 text-surface-950 hover:bg-user-400 cursor-pointer rounded-lg px-5 py-2 text-[11px] font-semibold transition-colors"
				>
					Next →
				</button>
			{/if}
		</div>
	</div>
</div>

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

<div class="space-y-2">
	<!-- Chat bubble for the question -->
	<div class="flex gap-2">
		<!-- Avatar -->
		<div
			class="bg-user-500 text-surface-950 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
		>
			?
		</div>
		<div class="max-w-[85%]">
			<div class="bg-surface-800/60 rounded-2xl rounded-tl-sm px-4 py-2.5">
				{#if !isSingleQuestion}
					<div class="text-text-500 mb-1 text-[10px]">{currentPage + 1} of {totalPages}</div>
				{/if}
				{#if currentQuestion.header}
					<div class="text-user-400 mb-0.5 text-[10px] font-semibold">
						{currentQuestion.header}
					</div>
				{/if}
				<div class="text-text-100 text-sm">{currentQuestion.question}</div>
			</div>
		</div>
	</div>

	<!-- Options as pill chips -->
	<div
		class="flex flex-wrap gap-1.5 pl-8"
		role={currentQuestion.multiSelect ? 'group' : 'radiogroup'}
	>
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
				class="cursor-pointer rounded-full border px-3 py-1.5 text-[12px] transition-all {selected
					? 'border-user-400 bg-user-500/20 text-user-400 font-medium'
					: 'border-surface-700 text-text-300 hover:border-surface-600 hover:bg-surface-800/30'}"
			>
				{option.label}
				{#if option.description}
					<span class="text-text-500 ml-0.5 text-[9px]">{option.description}</span>
				{/if}
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
				class="flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] transition-all {otherSelected
					? 'border-user-400 bg-user-500/20 text-user-400 font-medium'
					: 'border-surface-700 text-text-300 hover:border-surface-600 hover:bg-surface-800/30'}"
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
					class="w-16 min-w-0 bg-transparent text-[12px] focus:outline-none {otherSelected
						? 'text-text-100 placeholder-text-500 cursor-text'
						: 'text-text-500 cursor-pointer line-through'}"
				/>
			</button>
		{/if}
	</div>

	<!-- Navigation row -->
	<div class="flex items-center gap-2 pl-8">
		{#if !isSingleQuestion && !isFirstPage}
			<button
				onclick={goPrev}
				aria-label="Previous question"
				class="text-text-500 hover:text-text-300 cursor-pointer text-[11px] transition-colors"
			>
				← Back
			</button>
		{/if}

		{#if isSingleQuestion || isLastPage}
			<button
				onclick={handleSubmit}
				disabled={!hasAnyAnswer}
				class="bg-user-500 text-surface-950 rounded-full px-4 py-1.5 text-[11px] font-semibold transition-colors {hasAnyAnswer
					? 'hover:bg-user-400 cursor-pointer'
					: 'cursor-not-allowed opacity-40'}"
			>
				Send
			</button>
		{:else}
			<button
				onclick={goNext}
				aria-label="Next question"
				class="bg-user-500 text-surface-950 hover:bg-user-400 cursor-pointer rounded-full px-4 py-1.5 text-[11px] font-semibold transition-colors"
			>
				Next →
			</button>
		{/if}
	</div>
</div>

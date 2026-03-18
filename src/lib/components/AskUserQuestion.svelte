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

	function handleSubmit() {
		const result: Record<string, string | string[]> = {};
		for (let i = 0; i < request.questions.length; i++) {
			const q = request.questions[i];
			let answer = answers[i];
			const otherText = otherTexts[i]?.trim();

			if (q.multiSelect && Array.isArray(answer)) {
				if (answer.includes(OTHER_SENTINEL)) {
					const filtered = answer.filter((v) => v !== OTHER_SENTINEL);
					answer = otherText ? [...filtered, otherText] : filtered;
				}
			} else if (answer === OTHER_SENTINEL) {
				answer = otherText ?? '';
			}

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

<div class="border-l-user-400 bg-user-700/10 rounded-xl border-l-2 px-4 py-3">
	{#each request.questions as question, qi (qi)}
		<div class={qi > 0 ? 'border-surface-800/50 mt-4 border-t pt-4' : ''}>
			{#if question.header}
				<div class="text-text-100 mb-1 text-[11px] font-semibold">{question.header}</div>
			{/if}
			<div class="text-text-300 mb-2 text-sm">{question.question}</div>

			<div class="space-y-1" role={question.multiSelect ? 'group' : 'radiogroup'}>
				{#each question.options as option (option.label)}
					{@const value = option.value ?? option.label}
					{@const selected = isSelected(qi, value)}
					<button
						onclick={() =>
							question.multiSelect ? toggleMulti(qi, value) : selectSingle(qi, value)}
						role={question.multiSelect ? 'checkbox' : 'radio'}
						aria-checked={selected}
						class="hover:bg-surface-800/30 flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors {selected
							? 'border-user-400/30 bg-surface-800/50 border'
							: 'border border-transparent'}"
					>
						<!-- Radio / Checkbox indicator -->
						<span
							class="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-{question.multiSelect
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

				<!-- Other option — only for non-binary questions -->
				{#if question.options.length > 2}
					{@const otherSelected = isSelected(qi, OTHER_SENTINEL)}
					<button
						onclick={() =>
							question.multiSelect
								? toggleMulti(qi, OTHER_SENTINEL)
								: selectSingle(qi, OTHER_SENTINEL)}
						role={question.multiSelect ? 'checkbox' : 'radio'}
						aria-checked={otherSelected}
						class="hover:bg-surface-800/30 flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors {otherSelected
							? 'border-user-400/30 bg-surface-800/50 border'
							: 'border border-transparent'}"
					>
						<!-- Radio / Checkbox indicator -->
						<span
							class="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-{question.multiSelect
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
							bind:value={otherTexts[qi]}
							placeholder="Other..."
							onclick={(e) => {
								e.stopPropagation();
								if (!otherSelected) {
									question.multiSelect
										? toggleMulti(qi, OTHER_SENTINEL)
										: selectSingle(qi, OTHER_SENTINEL);
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
								: 'cursor-pointer text-text-500 line-through'}"
						/>
					</button>
				{/if}
			</div>
		</div>
	{/each}

	<div class="mt-3">
		<button
			onclick={handleSubmit}
			disabled={!hasAnyAnswer}
			class="bg-user-500 text-surface-950 rounded-lg px-4 py-2 text-[11px] font-semibold transition-colors {hasAnyAnswer
				? 'hover:bg-user-400 cursor-pointer'
				: 'cursor-not-allowed opacity-40'}"
		>
			Submit
		</button>
	</div>
</div>

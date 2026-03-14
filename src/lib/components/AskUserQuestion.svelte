<script lang="ts">
	import type { AskUserQuestionRequest } from '$lib/shared/active-session-types.js';

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
			const other = otherTexts[i]?.trim();

			if (other) {
				if (q.multiSelect && Array.isArray(answer)) {
					answer = [...answer, other];
				} else {
					answer = other;
				}
			}

			if (answer !== undefined) {
				result[q.question] = answer;
			}
		}
		onSubmit(result);
	}

	let hasAnyAnswer = $derived(
		Object.values(answers).some((a) =>
			Array.isArray(a) ? a.length > 0 : a !== undefined && a !== ''
		) || Object.values(otherTexts).some((t) => t?.trim())
	);
</script>

<div class="border-l-user-400 bg-user-700/10 rounded-xl border-l-2 px-4 py-3">
	{#each request.questions as question, qi (qi)}
		<div class={qi > 0 ? 'border-surface-800/50 mt-4 border-t pt-4' : ''}>
			{#if question.header}
				<div class="text-text-100 mb-1 text-[11px] font-semibold">{question.header}</div>
			{/if}
			<div class="text-text-300 mb-2 text-sm">{question.question}</div>

			<div class="space-y-1">
				{#each question.options as option (option.label)}
					{@const value = option.value ?? option.label}
					{@const selected = isSelected(qi, value)}
					<button
						onclick={() =>
							question.multiSelect ? toggleMulti(qi, value) : selectSingle(qi, value)}
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

				<!-- Other text input -->
				<div class="mt-2">
					<input
						type="text"
						bind:value={otherTexts[qi]}
						placeholder="Other..."
						class="border-surface-700 bg-surface-900 text-text-100 placeholder-text-500 w-full rounded-md border px-3 py-1.5 text-sm focus:outline-none"
					/>
				</div>
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

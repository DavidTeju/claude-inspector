<script lang="ts">
	import AskUserQuestion from '$lib/components/AskUserQuestion.svelte';
	import type { AskUserQuestionRequest } from '$lib/shared/active-session-types.js';

	const singleRequest: AskUserQuestionRequest = {
		id: 'test-1',
		questions: [
			{
				question: 'Which framework do you prefer?',
				header: 'Framework Choice',
				options: [
					{ label: 'React', description: 'Meta framework' },
					{ label: 'Svelte', description: 'Compiler-first' },
					{ label: 'Vue', description: 'Progressive framework' }
				]
			}
		],
		timestamp: new Date().toISOString()
	};

	const multiRequest: AskUserQuestionRequest = {
		id: 'test-2',
		questions: [
			{
				question: 'Which framework do you prefer?',
				header: 'Framework Choice',
				options: [
					{ label: 'React', description: 'Meta framework' },
					{ label: 'Svelte', description: 'Compiler-first' },
					{ label: 'Vue', description: 'Progressive framework' }
				]
			},
			{
				question: 'Which language do you use?',
				header: 'Language',
				options: [
					{ label: 'TypeScript' },
					{ label: 'JavaScript' },
					{ label: 'Python' },
					{ label: 'Rust' }
				]
			},
			{
				question: 'Select your preferred tools',
				header: 'Tooling',
				multiSelect: true,
				options: [
					{ label: 'ESLint' },
					{ label: 'Prettier' },
					{ label: 'Vitest' },
					{ label: 'Playwright' }
				]
			}
		],
		timestamp: new Date().toISOString()
	};

	function handleSubmit(answers: Record<string, string | string[]>) {
		// eslint-disable-next-line no-console
		console.log('Submitted:', answers);
	}
</script>

<div class="bg-surface-950 min-h-screen p-8">
	<h2 class="text-text-100 mb-4 text-lg font-bold">Single Question (no pagination)</h2>
	<div class="mb-8 max-w-lg">
		<AskUserQuestion request={singleRequest} onSubmit={handleSubmit} />
	</div>

	<h2 class="text-text-100 mb-4 text-lg font-bold">Multiple Questions (paginated wizard)</h2>
	<div class="max-w-lg">
		<AskUserQuestion request={multiRequest} onSubmit={handleSubmit} />
	</div>
</div>

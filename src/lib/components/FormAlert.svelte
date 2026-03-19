<script lang="ts">
	let {
		type,
		message,
		class: className = ''
	}: {
		type: 'success' | 'error';
		message: string;
		class?: string;
	} = $props();
</script>

<div
	class="rounded-md border px-3 py-2 text-xs {type === 'success'
		? 'border-success-500/30 bg-success-500/10 text-success-500'
		: 'border-error-500/30 bg-error-500/10 text-error-400'} {className}"
>
	{message}
</div>

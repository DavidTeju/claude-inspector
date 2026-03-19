<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
</script>

<div class="flex flex-1 flex-col items-center justify-center py-20 text-center">
	<div class="text-destructive mb-2 text-6xl font-bold tabular-nums">
		{page.status}
	</div>
	<p class="text-foreground/80 mb-6 text-sm">
		{page.error?.message ?? 'Something went wrong'}
	</p>
	<a
		href={resolve('/')}
		class="border-border bg-card text-foreground hover:border-border hover:text-foreground rounded-md border px-4 py-2 text-xs transition-colors"
	>
		Back to home
	</a>
</div>

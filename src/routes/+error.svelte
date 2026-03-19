<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
</script>

<div class="flex flex-1 flex-col items-center justify-center py-20 text-center">
	<div class="text-error mb-2 text-6xl font-bold tabular-nums">
		{page.status}
	</div>
	<p class="text-base-content/70 mb-6 text-sm">
		{page.error?.message ?? 'Something went wrong'}
	</p>
	<a href={resolve('/')} class="btn btn-ghost rounded-md px-4 py-2 text-xs"> Back to home </a>
</div>

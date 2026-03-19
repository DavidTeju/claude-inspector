<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
</script>

<div class="hero-gradient flex flex-1 flex-col items-center justify-center py-20 text-center">
	<div class="text-error mb-4 text-8xl font-black tabular-nums">
		{page.status}
	</div>
	<p class="text-base-content/70 mb-8 max-w-md text-base">
		{page.error?.message ?? 'Something went wrong'}
	</p>
	<a href={resolve('/')} class="btn btn-primary"> Back to home </a>
</div>

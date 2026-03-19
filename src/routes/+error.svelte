<script lang="ts">
	import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
	import Home from '@lucide/svelte/icons/home';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent } from '$lib/components/ui/card/index.js';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
</script>

<div class="flex flex-1 flex-col items-center justify-center py-20 text-center">
	<Card class="w-full max-w-md">
		<CardContent class="flex flex-col items-center gap-4 py-10">
			<AlertTriangle class="text-destructive size-10" />
			<div class="text-destructive text-6xl font-bold tabular-nums">
				{page.status}
			</div>
			<p class="text-muted-foreground text-sm">
				{page.error?.message ?? 'Something went wrong'}
			</p>
			<Button variant="outline" href={resolve('/')}>
				<Home data-icon="inline-start" class="size-4" />
				Back to home
			</Button>
		</CardContent>
	</Card>
</div>

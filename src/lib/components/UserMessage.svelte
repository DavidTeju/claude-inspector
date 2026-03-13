<script lang="ts">
	import { formatTime } from '$lib/utils.js';

	let {
		message
	}: {
		message: {
			uuid: string;
			timestamp: string;
			textContent: string;
			rawContent: string | Array<{ type: string; text?: string }>;
		};
	} = $props();
</script>

<div class="flex justify-end">
	<div class="max-w-[85%] rounded-lg border border-user-700/50 bg-user-700/30 px-4 py-3">
		<div class="mb-1.5 flex items-center justify-between gap-4">
			<span class="text-[10px] font-semibold uppercase tracking-wider text-blue-400/70">You</span>
			<span class="text-[10px] text-zinc-600">{formatTime(message.timestamp)}</span>
		</div>
		<div class="text-sm leading-relaxed text-zinc-200 whitespace-pre-wrap break-words">
			{message.textContent}
		</div>
	</div>
</div>

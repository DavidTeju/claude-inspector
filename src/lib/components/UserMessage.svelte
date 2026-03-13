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
	<div class="border-user-700/50 bg-user-700/30 max-w-[85%] rounded-lg border px-4 py-3">
		<div class="mb-1.5 flex items-center justify-between gap-4">
			<span class="text-[10px] font-semibold tracking-wider text-blue-400/70 uppercase">You</span>
			<span class="text-[10px] text-zinc-600">{formatTime(message.timestamp)}</span>
		</div>
		<div class="text-sm leading-relaxed break-words whitespace-pre-wrap text-zinc-200">
			{message.textContent}
		</div>
	</div>
</div>

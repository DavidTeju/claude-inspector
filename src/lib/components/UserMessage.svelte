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
	<div
		class="border-l-user-400/40 bg-user-700/40 max-w-[85%] rounded-xl rounded-br-md border-l-2 px-4 py-3"
	>
		<div class="mb-1.5 flex items-center justify-between gap-4">
			<span class="text-user-400 text-[10px] font-semibold tracking-wider uppercase">You</span>
			<span class="text-text-500 text-[10px]">{formatTime(message.timestamp)}</span>
		</div>
		<div class="text-text-100 font-mono text-sm leading-relaxed break-words whitespace-pre-wrap">
			{message.textContent}
		</div>
	</div>
</div>

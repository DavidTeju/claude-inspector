import { searchSessionsStreaming } from '$lib/server/search.js';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q') || '';
	const projectFilter = url.searchParams.get('project') || undefined;
	const encoder = new TextEncoder();

	if (!query || query.length < 2) {
		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(
					encoder.encode(`event: done\ndata: ${JSON.stringify({ totalSessions: 0 })}\n\n`)
				);
				controller.close();
			}
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			}
		});
	}

	let rgProcess: ReturnType<typeof searchSessionsStreaming> = null;

	const stream = new ReadableStream({
		start(controller) {
			rgProcess = searchSessionsStreaming(
				query,
				{
					onResult: (result) => {
						try {
							controller.enqueue(
								encoder.encode(`event: result\ndata: ${JSON.stringify(result)}\n\n`)
							);
						} catch {
							// Controller may be closed if client disconnected
						}
					},
					onDone: (totalSessions) => {
						try {
							controller.enqueue(
								encoder.encode(`event: done\ndata: ${JSON.stringify({ totalSessions })}\n\n`)
							);
							controller.close();
						} catch {
							// Controller may already be closed
						}
					},
					onError: (error) => {
						try {
							controller.enqueue(
								encoder.encode(`event: error\ndata: ${JSON.stringify({ error })}\n\n`)
							);
							controller.close();
						} catch {
							// Controller may already be closed
						}
					}
				},
				projectFilter
			);
		},
		cancel() {
			// Client disconnected — kill the rg process
			if (rgProcess) {
				rgProcess.kill();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};

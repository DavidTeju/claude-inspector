---
name: async-dedup-race-in-streaming-pipelines
description: |
  Fix invisible/broken rendering when streaming deduplicated results through SSE or WebSocket
  pipelines with async enrichment. Use when: (1) a counter/count shows items exist but UI renders
  nothing or fewer items than expected, (2) Svelte keyed {#each} or React key-based lists show
  blank despite array having items, (3) streaming pipeline uses async processing per item with
  a dedup Map/Set check before the await, (4) fire-and-forget async calls with
  Promise.then() lose results when parent stream closes. Root cause: dedup check happens before
  async gap, allowing concurrent calls for the same key to all pass, producing duplicate emissions.
  Secondary cause: onDone/stream-close fires before all async promises resolve, silently dropping
  late results.
author: Claude Code
user-invocable: false
---

# Async Dedup Race Condition in Streaming Pipelines

## Problem

When processing a stream of items (e.g., ripgrep matches, database results, API responses)
where each item requires async enrichment (e.g., loading metadata from disk, fetching from
an API) and deduplication, placing the dedup check before the async call creates a race
condition that produces duplicate emissions. In UI frameworks with keyed lists (Svelte `{#each}`,
React `key`), duplicate keys cause silent rendering failures — the count appears correct but
items are invisible.

## Context / Trigger Conditions

- A streaming pipeline processes items with async enrichment per item
- Deduplication uses a Map or Set, checked before an `await` call
- Multiple items with the same dedup key arrive in rapid succession
- UI shows a count of items (e.g., "13 results") but renders 0 or fewer cards/rows
- The `{#each}` or `.map()` uses a key derived from the deduplicated field
- Fire-and-forget pattern: `processItem(item).then(...)` without collecting promises
- Stream close/done signal fires before all async operations complete

## Solution

### Fix 1: Synchronous Dedup Reservation

Move the dedup check to a synchronous point BEFORE spawning the async work. Reserve the
slot immediately, then unreserve if the async processing determines the item should be
filtered out.

```typescript
// BAD: Race condition — multiple concurrent calls pass the check
async function processMatch(match) {
    const key = `${match.projectId}/${match.sessionId}`;
    const existing = seenSessions.get(key);  // Check BEFORE await
    if (existing) return false;

    const meta = await loadMetadata();        // Async gap — race window!

    seenSessions.set(key, result);            // Set AFTER await — too late
    emit(result);
    return true;
}

// Called in a loop without await:
processMatch(match).then(emitted => { if (emitted) count++; });
```

```typescript
// GOOD: Synchronous reservation prevents duplicates
const seenSessions = new Set<string>();
const pendingPromises: Promise<void>[] = [];

for (const match of matches) {
    const key = `${match.projectId}/${match.sessionId}`;
    if (seenSessions.has(key)) continue;  // Sync check — no race
    seenSessions.add(key);                 // Sync reservation — immediate

    const promise = processMatch(match).then(result => {
        if (result) {
            totalEmitted++;
        } else {
            seenSessions.delete(key);  // Unreserve on filter-out
        }
    });
    pendingPromises.push(promise);
}
```

### Fix 2: Await All Promises Before Done Signal

Never use a fixed timeout to wait for async work. Use `Promise.all` instead.

```typescript
// BAD: Arbitrary timeout — unreliable
childProcess.on('close', () => {
    setTimeout(() => callbacks.onDone(totalEmitted), 50);  // 50ms is a guess
});

// GOOD: Wait for all work to complete
childProcess.on('close', () => {
    Promise.all(pendingPromises).then(() => {
        callbacks.onDone(totalEmitted);
    });
});
```

### Fix 3: Cache Shared Resources

When many concurrent async calls read the same resource (e.g., all matches from one
project read the same `sessions-index.json`), add a TTL cache to avoid redundant I/O.

```typescript
const cache = new Map<string, { data: Data; timestamp: number }>();
const CACHE_TTL = 5000;

async function loadWithCache(key: string): Promise<Data | null> {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
    const data = await loadFromDisk(key);
    if (data) cache.set(key, { data, timestamp: Date.now() });
    return data;
}
```

## Verification

1. Search for a very common/short term that produces many matches from the same source
2. Verify the result count matches the number of visible UI cards
3. Verify no duplicate keys in the rendered list (browser DevTools → Elements)
4. Verify the "done" signal fires AFTER the last result is emitted

## Example

**Scenario**: ripgrep search with `--max-count 5` finds 5 matches per JSONL file. With
200 files matching "me", 1000 `processMatch()` calls spawn concurrently. Each reads
`sessions-index.json` for metadata. Without sync dedup, 5 calls per file all pass the
Map check before any sets it → 5 duplicate SSE events per session → Svelte's keyed
`{#each}` gets duplicate keys → renders 0 visible cards despite `results.length = 13`.

**After fix**: Sync `Set.add()` in the data handler ensures exactly 1 call per session
proceeds to async enrichment. `Promise.all` ensures all results are emitted before the
stream closes.

## Additional Pattern: Child Process stdout Buffer Corruption

When parsing `--json` output from a child process (like ripgrep) incrementally via `data`
events, multi-megabyte output lines get split at arbitrary byte boundaries across events.
The common pattern `buffer += chunk.toString(); lines = buffer.split('\n')` appears correct
but produces **non-deterministic failures**:

- Different runs split at different points → different lines fail to parse
- `JSON.parse` silently fails on the corrupted line → `catch` drops it
- Result counts vary across identical queries (e.g., 8, 5, 9, 4)

**Root cause**: Not UTF-8 splitting (though that's a factor too) — it's that `buffer.split('\n')`
can produce a "complete" line that's actually a fragment of a longer line if `\n` appears
inside a JSON string value (escaped as literal characters in the source data being searched).

**Fix**: `Buffer.concat` all chunks and parse after the `close` event:
```javascript
const chunks = [];
process.stdout.on('data', chunk => chunks.push(chunk));
process.on('close', () => {
  const output = Buffer.concat(chunks).toString('utf-8');
  const lines = output.split('\n');
  // Now parse — every line is guaranteed complete
});
```

**Tradeoff**: No progressive results (all arrive at once after process exits). For search UIs,
this means a brief delay but guaranteed correctness and consistency.

## Notes

- This pattern applies to ANY streaming pipeline with async per-item processing + dedup,
  not just ripgrep/SSE. Database streaming, WebSocket message processing, queue consumers
  — all vulnerable.
- Svelte 5's keyed `{#each}` with duplicate keys produces unpredictable results (some or
  all items invisible). React behaves similarly with duplicate `key` props.
- The "unreserve on filter-out" pattern (`seenSessions.delete(key)`) is important: if the
  first match for a session fails post-filtering, later matches for the same session should
  still have a chance to pass.
- When using SSE with `ReadableStream`, `controller.enqueue()` after `controller.close()`
  throws silently (if wrapped in try/catch), causing results to vanish without error logs.

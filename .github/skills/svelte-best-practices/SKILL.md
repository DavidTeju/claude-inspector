---
name: svelte-best-practices
description: Svelte 5 best practices including runes ($state, $derived, $effect), dependency tracking patterns, global/shared state, SSR safety, ESLint configuration, and component patterns
user-invocable: true
---

# Svelte 5 Best Practices

Reference for Svelte 5 runes mode. Assumes familiarity with Svelte basics.

---

## Runes

### $state

- Only use `$state` for values that drive reactivity (effects, derived, template).
- `$state({...})` / `$state([...])` gives deep reactivity via proxies. Use `$state.raw` for large objects that only get reassigned (e.g., API responses) to avoid proxy overhead.

### $derived

Compute values from state with `$derived`, never with `$effect`:

```js
// Good
let square = $derived(num * num);

// Bad — don't use effects to compute values
let square;
$effect(() => { square = num * num; });
```

- `$derived` takes an expression. Use `$derived.by(() => ...)` for complex logic.
- Derived values are writable (assignable like `$state`), but re-evaluate when deps change.

### $props and $bindable

Props can change at any time. Anything derived from props needs `$derived`:

```js
// Correct — updates when type changes
let color = $derived(type === 'danger' ? 'red' : 'green');

// Wrong — color is computed once and never updates
let color = type === 'danger' ? 'red' : 'green';
```

Use `$bindable` for two-way parent-child state sync instead of effects that call parent callbacks:

```svelte
<!-- Child -->
<script>
  let { value = $bindable() } = $props();
</script>
<input bind:value />

<!-- Parent -->
<Child bind:value={name} />
```

### $inspect.trace

Debug reactivity issues by adding `$inspect.trace(label)` as the first line in `$effect` or `$derived.by` to trace which dependencies triggered an update.

---

## $effect — Patterns and Pitfalls

**$effect is an escape hatch. Use it minimally.**

**Red flag: if your `$effect` writes to `$state`, it's almost certainly wrong.** It's either a `$derived` in disguise or logic that belongs in an event handler.

### When NOT to use $effect

| Instead of $effect... | Use this |
|---|---|
| Compute a value from state | `$derived` / `$derived.by` |
| Expensive computation that depends on state | `$derived.by` (Svelte's equivalent of `useMemo`) |
| Respond to user interaction | Event handler or function binding |
| Send a request on form submit | Event handler (`onsubmit`) |
| Notify parent of state change | Call callback prop directly in the event handler, or use `$bindable` |
| Sync two pieces of state | `$derived` + function binding (not two competing effects) |
| Chain of effects triggering each other | Compute everything in a single event handler or use `$derived` |
| Reset component state when a value changes | `{#key value}` block (see below) |
| Fetch data | SvelteKit `load` function, not `$effect` |
| Sync state to external lib (D3, chart) | `{@attach ...}` |
| Debug reactive values | `$inspect` |
| Observe external data | `createSubscriber` |

Never wrap effect contents in `if (browser) {...}` — effects already skip SSR.

### When TO use $effect

$effect is correct when you need to synchronize with something **outside Svelte's reactive system**:

- **DOM APIs** — canvas drawing, focus management, element measurement, third-party DOM libs (maps, editors)
- **Timers/intervals** — `setInterval`/`setTimeout` with teardown (see cleanup pattern below)
- **Non-Svelte event listeners** — `window`, `ResizeObserver`, `IntersectionObserver`, `WebSocket` (when `<svelte:window>` doesn't cover it)
- **Browser APIs** — `document.title`, `localStorage` syncing, `navigator` APIs
- **Analytics/logging** — fire-and-forget side effects that don't write back to state

### $effect Cleanup

Return a function from `$effect` for teardown. Svelte calls it before re-running and on destroy:

```js
$effect(() => {
  const id = setInterval(() => tick(), delay);
  return () => clearInterval(id);
});
```

```js
$effect(() => {
  const observer = new ResizeObserver(entries => handleResize(entries));
  observer.observe(element);
  return () => observer.disconnect();
});
```

### Dependency Tracking

Svelte tracks dependencies by detecting which reactive values are **read** during effect execution. There are no explicit dependency arrays — [GitHub issues #9248 and #13207 requesting them were closed as "not planned"](https://github.com/sveltejs/svelte/issues/9248).

**Svelte reactivity only tracks its own primitives** (`$state`, `$derived`, `$props`). DOM properties like `scrollHeight`, `offsetWidth` are plain reads — NOT tracked. If you need to react to DOM changes caused by state changes, depend on the state, not the DOM property.

### void + untrack Pattern (Explicit Dependency Control)

When an effect needs specific triggers but its logic reads other reactive values or DOM properties, use `void` to declare dependencies and `untrack()` to isolate logic:

```svelte
<script>
  import { untrack } from 'svelte';

  let { messages, streamingText, pendingPermissions } = $props();
  let container;

  $effect.pre(() => {
    // Declare dependencies — void evaluates (registers with tracker) and discards
    void messages.length;
    void streamingText;
    void pendingPermissions;

    untrack(() => {
      // Logic reads DOM properties freely without registering them as deps
      const threshold = 200;
      if (container.scrollHeight - container.scrollTop < threshold) {
        container.scrollTo(0, container.scrollHeight);
      }
    });
  });
</script>
```

- The official docs show bare `messages.length;` statements in `$effect.pre` to declare dependencies.
- `void val;` is the **lint-safe** version — identical runtime behavior, no ESLint warnings (except `sonarjs/void-use`, see ESLint section).
- Svelte maintainer dummdidumm's endorsed pattern for explicit deps: read deps via a function, then `untrack(fn)` for logic.

### $effect.pre vs $effect

- `$effect.pre` runs **before** DOM updates (equivalent to `beforeUpdate`). Use for scroll management, DOM measurement before paint.
- `$effect` runs **after** DOM updates.

---

## Auto-resize Textarea (Ranked Approaches)

1. **`field-sizing: content`** — Pure CSS, no JS. ~80% browser support (not Firefox).
2. **`oninput` handler** — Idiomatic Svelte 5, no $effect. Only handles user input.
3. **`$effect` with natural read** — Needed when text changes programmatically.
4. **Hidden `<pre>` mirror** — Official Svelte playground approach, no JS height calc.
5. **Svelte action (`use:autosize`)** — Reusable across textareas.

---

## Events

```svelte
<!-- Standard -->
<button onclick={() => doThing()}>click</button>

<!-- Shorthand -->
<button {onclick}>click</button>

<!-- Spread -->
<button {...props}>click</button>

<!-- Window/document events — don't use onMount/$effect for these -->
<svelte:window onkeydown={handleKey} />
<svelte:document onvisibilitychange={handleVisibility} />
```

---

## Snippets

Reusable markup chunks, replacing slots:

```svelte
{#snippet greeting(name)}
  <p>hello {name}!</p>
{/snippet}

{@render greeting('world')}
```

- Top-level snippets work inside `<script>`.
- Stateless snippets work in `<script module>` and can be exported.

---

## Each Blocks

Always use keyed each blocks. Keys must uniquely identify items — never use indices:

```svelte
{#each items as item (item.id)}
  <Item {item} />
{/each}
```

Skip destructuring when mutating items (e.g., `bind:value={item.count}`).

---

## Key Blocks

Use `{#key}` to destroy and recreate content when a value changes — Svelte's equivalent of React's `key` prop for resetting component state:

```svelte
{#key userId}
  <!-- EditProfile is fully destroyed and recreated when userId changes -->
  <!-- All its internal $state resets — no $effect needed -->
  <EditProfile {userId} />
{/key}
```

Don't use `$effect` to manually reset multiple state variables when a prop changes. Wrap the component in `{#key}` instead.

---

## Styling

### JS Variables in CSS

```svelte
<div style:--columns={columns}>...</div>

<style>
  div { grid-template-columns: repeat(var(--columns), 1fr); }
</style>
```

### Styling Child Components

Prefer CSS custom properties. Fall back to `:global` only when necessary:

```svelte
<!-- Parent -->
<Child --color="red" />

<!-- Child -->
<style>
  h1 { color: var(--color); }
</style>
```

```svelte
<!-- Override when custom properties aren't an option -->
<div>
  <Child />
</div>

<style>
  div :global {
    h1 { color: red; }
  }
</style>
```

---

## Global & Shared State

### The Module Boundary Problem

`$state` reactivity does not cross module boundaries on raw exports. Importing a bare `$state` variable freezes its value — the importer gets a static snapshot, not a live binding:

```ts
// counter.svelte.ts
let count = $state(0);
export { count }; // BUG: importers see 0 forever
```

For state to remain reactive across modules, it must be enclosed in a **closure** (getter/setter, object property, or class field).

### Cross-Module State Patterns (Ranked)

**1. `$state` object** — simplest, recommended for most cases:

```ts
export const counter = $state({ value: 0 });
```

Svelte wraps the object in a Proxy, so property mutations are reactive. Cannot reassign the object itself (`counter = { value: 2 }` won't propagate).

**2. Class with `$state` fields** — better V8 optimization, scales to complex state:

```ts
class Counter {
  value = $state(0);
  increment() { this.value++; }
}
export const counter = new Counter();
```

**3. Getter/setter functions** — explicit, no proxy overhead:

```ts
let count = $state(0);
export function getCount() { return count; }
export function setCount(v: number) { count = v; }
```

**4. Object with property accessors** — cleaner call-site than functions:

```ts
let count = $state(0);
export const counter = {
  get value() { return count; },
  set value(v) { count = v; }
};
```

### SSR Safety: Why Module State Is Dangerous

Module-level state is a **singleton** — one instance shared across all requests on the server. This causes:

- **Cross-request pollution**: Request A's state bleeds into Request B.
- **Async race conditions**: Request 1 sets user, starts an async fetch. Request 2 overwrites user. Request 1's fetch resolves with Request 2's context.

### Safe Patterns for Isomorphic Apps

**Server-side — use `event.locals`** (request-scoped, no leakage):

```ts
// hooks.server.ts
export async function handle({ event, resolve }) {
  const cookie = event.cookies.get('user');
  if (cookie) event.locals.user = await fetchUser(cookie);
  return resolve(event);
}
```

**Client-side — use context with `$state`** (fresh per component tree):

```ts
// notification-context.svelte.ts
import { getContext, setContext } from 'svelte';

const KEY = Symbol();

export function setNotifications(initial: string[]) {
  return setContext(KEY, $state(initial));
}

export function getNotifications() {
  return getContext<string[]>(KEY);
}
```

```svelte
<!-- +layout.svelte -->
<script>
  import { setNotifications } from '$lib/notification-context.svelte.ts';
  const { children } = $props();
  setNotifications([]);
</script>
{@render children()}
```

Context instantiates fresh per request on the server and per component tree on the client — no cross-request pollution.

Use `createContext` over raw `setContext`/`getContext` for type safety when available.

---

## ESLint Configuration for Svelte

### sonarjs/void-use

The `void` dependency pattern is canonical Svelte 5. Disable this rule for `.svelte` files:

```js
// eslint.config.js
{
  files: ['**/*.svelte'],
  rules: {
    'sonarjs/void-use': 'off',
  },
}
```

### import-x/no-unresolved

SvelteKit virtual modules need to be ignored:

```js
{
  rules: {
    'import-x/no-unresolved': ['error', {
      ignore: ['^\\$app/', '^\\$env/', '^\\$service-worker']
    }],
  },
}
```

### import-x/no-duplicates

Svelte re-exports from `svelte/transition`, `svelte/easing`, etc. may trigger false warnings. Suppress per-case if needed.

---

## Legacy Feature Replacements

| Legacy | Svelte 5 Replacement |
|---|---|
| `let count = 0` (implicit reactivity) | `$state` |
| `$:` statements | `$derived` / `$effect` |
| `export let` / `$$props` / `$$restProps` | `$props` |
| `on:click={...}` | `onclick={...}` |
| `<slot>` / `$$slots` / `<svelte:fragment>` | `{#snippet}` / `{@render}` |
| `<svelte:component this={...}>` | `<DynamicComponent>` |
| `<svelte:self>` | Direct self-import |
| Stores | Classes with `$state` fields |
| `use:action` | `{@attach ...}` |
| `class:` directive | `class` with clsx-style arrays/objects |

---

## Async (Experimental)

Svelte 5.36+ supports await expressions in components. Requires `experimental.async` in `svelte.config.js`. Not stable — use cautiously.

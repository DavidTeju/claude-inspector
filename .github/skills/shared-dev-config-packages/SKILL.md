---
name: shared-dev-config-packages
description: |
  Gotchas when building shared ESLint/Prettier/TypeScript config packages installed
  from GitHub. Use when: (1) "Cannot find package" errors from a shared config's imports,
  (2) tsconfig paths resolve to wrong directory after extending shared config,
  (3) ESLint flat config overrides not taking effect for test/script files,
  (4) "getVisitorKeys is not a function" from prettier-plugin-tailwindcss.
  Covers npm symlink resolution, tsconfig extends path semantics, ESLint flat
  config ordering, and prettier plugin version compatibility.
user-invocable: false
---

# Shared Dev Config Package Gotchas

## Problem
When creating a shared npm package that exports ESLint, Prettier, and TypeScript configs
(installed via `npm install github:org/repo`), several non-obvious resolution and ordering
issues arise that don't surface in monorepo or single-project setups.

## Gotcha 1: npm Symlinks Break Module Resolution

### Trigger
`Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'eslint-plugin-svelte'` when the plugin
is installed in the consumer but not in the config package.

### Cause
`npm install ../local-package` creates a symlink. Node resolves imports relative to the
**real file path** (inside the config package), not the consuming project. So peer dependencies
in the consumer's `node_modules/` are invisible to the config package's code.

### Fix
- **For production**: Make directly-imported packages `dependencies` (not `peerDependencies`)
  in the config package. npm will hoist them alongside the consumer's copies and dedupe
  compatible versions.
- **For local testing**: Use `npm pack` + install the tarball, which copies files instead of
  symlinking, giving proper dependency hoisting.
- Keep `eslint`, `prettier`, `typescript` as `peerDependencies` (consumers run these directly).
- Keep framework-specific plugins the config imports (e.g., `eslint-plugin-svelte`,
  `typescript-eslint`) as `dependencies`.

## Gotcha 2: tsconfig `paths` Resolve Relative to Config File Location

### Trigger
`error TS2307: Cannot find module '@/lib/foo'` after extending a shared tsconfig that
defines `"paths": { "@/*": ["./src/*"] }`.

### Cause
TypeScript resolves `paths` relative to the tsconfig file that defines them. When the shared
config lives at `node_modules/@scope/dev-config/tsconfig/nextjs.json`, the path `./src/*`
resolves to `node_modules/@scope/dev-config/tsconfig/src/*` — not the project's `src/`.

### Fix
Never put `paths` in a shared tsconfig. Each consuming project must define its own `paths`
in its local `tsconfig.json`. This also applies to `baseUrl`.

## Gotcha 3: ESLint Flat Config Override Ordering

### Trigger
Rules that should be disabled for test files (e.g., `no-restricted-syntax: off`) are still
firing on test files. Hundreds of unexpected violations appear in test output.

### Cause
ESLint flat config applies rules in array order, last-wins. If the config array is:
```
[strictRules, testOverrides, projectSpecificRules]
```
...and `projectSpecificRules` sets `no-restricted-syntax` globally (no `files` filter),
it **re-enables** the rule for all files, undoing `testOverrides`.

### Fix
Place file-scoped overrides (test, script, vitest) **after** all global rule configs:
```js
defineConfig([
  ...baseConfigs,
  strictRules,
  projectSpecificRules,  // global rules FIRST
  testFileOverrides,     // scoped overrides LAST
  scriptFileOverrides,
  vitestTestOverrides,
])
```

## Gotcha 4: prettier-plugin-tailwindcss Version Compatibility

### Trigger
`TypeError: getVisitorKeys is not a function or its return value is not iterable`
at `printEmbeddedLanguages` in prettier's internals.

### Cause
`prettier-plugin-tailwindcss@0.6.x` doesn't implement the `getVisitorKeys` interface
that `prettier@3.8.x` expects for embedded language printing.

### Fix
Upgrade to `prettier-plugin-tailwindcss@0.7+`. This can be triggered silently when a
shared config package pulls in a newer prettier version via its dependency chain.

## Notes
- The symlink issue only affects local development (`file:../` installs). GitHub installs
  (`github:org/repo`) copy files and hoist correctly.
- When a shared config uses `try { await import(...) } catch {}` for optional plugins (like
  vitest), the top-level await requires the package to be `"type": "module"`.
- Shared prettier configs that reference plugin names as strings (not imports) resolve from
  the consumer's `node_modules` — no symlink issue there.

# Copilot Instructions for Claude Inspector

## Project Overview

Claude Inspector is a local web UI for browsing, searching, and interacting with Claude Code sessions. It reads JSONL session files from `~/.claude/projects/` and provides full-text search, a rich conversation viewer, and live session streaming.

## Tech Stack

- **Framework:** SvelteKit 2 with Svelte 5 (runes-based reactivity: `$props()`, `$state()`, `$derived()`)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS v4 with custom theme tokens defined in `src/app.css`
- **Build Tool:** Vite
- **Database:** SQLite via `better-sqlite3` for session indexing
- **Search:** `@vscode/ripgrep` for full-text search fallback
- **Code Highlighting:** Shiki
- **Claude Integration:** `@anthropic-ai/claude-agent-sdk` and `@anthropic-ai/sdk`

## Build, Lint, and Check Commands

```bash
npm run build        # Production build (vite build)
npm run dev          # Start dev server
npm run check        # TypeScript type checking (svelte-kit sync && svelte-check)
npm run lint         # ESLint
npm run lint:fix     # ESLint with auto-fix
npm run knip         # Detect unused exports/dead code
```

There is no test runner configured. The `tests/` directory contains only fixture data.

## Directory Structure

```
src/
├── lib/
│   ├── components/    # Svelte UI components (PascalCase filenames)
│   ├── server/        # Server-side modules (session parsing, search, SQLite, Claude SDK)
│   ├── stores/        # Svelte reactive stores (*.svelte.ts)
│   ├── shared/        # Shared types and constants used by both client and server
│   ├── types.ts       # Main TypeScript interfaces
│   ├── utils.ts       # Shared utility functions
│   └── constants.ts   # Application constants
├── routes/            # SvelteKit file-based routing
│   ├── api/           # Server API endpoints (+server.ts files)
│   ├── projects/      # Project and session list pages
│   ├── session/       # Session message viewer
│   └── settings/      # Configuration pages
├── app.css            # Tailwind v4 theme and global styles
└── hooks.server.ts    # SvelteKit server hooks
```

## Coding Conventions

### TypeScript
- Use strict mode with explicit type annotations on function parameters and return types
- Define data models as `interface` declarations in `src/lib/types.ts` or `src/lib/shared/`
- Use type guards in `src/lib/shared/type-guards.ts` for runtime type checking
- Constants use `SCREAMING_SNAKE_CASE`

### Svelte Components
- Use Svelte 5 runes (`$props()`, `$state()`, `$derived()`) — do not use legacy `export let` or `$:` syntax
- Script tags must use `<script lang="ts">`
- Style with Tailwind utility classes; avoid `<style>` blocks
- Component files use PascalCase (e.g., `UserMessage.svelte`)

### File Naming
- Components: `PascalCase.svelte`
- Utilities/modules: `camelCase.ts` or `kebab-case.ts`
- Store files: `*.svelte.ts`
- SvelteKit routes follow conventions: `+page.svelte`, `+server.ts`, `+layout.svelte`

### Code Style
- ESLint and Prettier configs extend `@davidteju/dev-config`
- The `svelte/no-at-html-tags` ESLint rule is intentionally disabled (for rendered markdown and search highlights)
- Run `npm run lint` and `npm run check` to validate changes

### Server Code
- Server-only code goes in `src/lib/server/` and is not importable from client code
- API routes live under `src/routes/api/` as `+server.ts` files
- SQLite database operations are in `src/lib/server/db/`

## Key Patterns

- **Session parsing:** JSONL files are parsed by `src/lib/server/session-parser.ts`
- **Search:** Two backends — SQLite FTS for indexed search, ripgrep for file-level search
- **Live sessions:** Claude SDK integration streams responses via Server-Sent Events
- **Theme:** Light/dark mode with system-aware switching via CSS custom properties

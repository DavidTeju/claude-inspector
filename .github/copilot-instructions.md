# Copilot instructions for Claude Inspector

- This repository is a SvelteKit 2 app using Svelte 5 runes and TypeScript. Follow the existing component and module patterns in `src/routes`, `src/lib/components`, and `src/lib/server`.
- Use `npm` for package management and prefer the existing scripts for validation: `npm run lint`, `npm run check`, and `npm run build`.
- Keep changes focused and local to the feature being worked on. Reuse the shared types and utilities in `src/lib` before adding new abstractions.
- Server-side session indexing, parsing, search, and live session management belong in `src/lib/server`. UI rendering and page composition belong in Svelte components and route files.
- Claude session data comes from `~/.claude/` by default, or `CLAUDE_DATA_PATH` when it is set. Preserve that behavior when changing code that touches data access or session discovery.
- Search supports structured filters such as `tool:Read`, `branch:main`, `is:subagent`, and `mode:raw`. Maintain existing query behavior when updating search-related code.
- The project extends shared linting and formatting rules from `@davidteju/dev-config`; match the existing code style instead of introducing new formatting or tooling conventions.

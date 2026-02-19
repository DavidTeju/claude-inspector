# Claude Inspector

A local web UI for browsing, reading, and searching Claude Code session data. Claude Code stores all conversations as JSONL files in `~/.claude/projects/` — this app provides a searchable, navigable interface to explore them.

## Features

- **Project browser** — Lists all projects from `~/.claude/projects/` with session counts and last-modified dates
- **Session list** — Sortable table of sessions per project with summaries, first prompts, message counts, and git branches
- **Message viewer** — Full conversation renderer with:
  - User/assistant message threading via `parentUuid` chain
  - Collapsible tool call blocks with paired input/result display
  - Collapsible thinking blocks with character counts
  - Markdown rendering with syntax-highlighted code blocks (shiki)
- **Full-text search** — Two-phase search: instant metadata search from session indexes, then JSONL content scan with highlighted snippets
- **Dark theme** — Code editor aesthetic with zinc/indigo palette

## Quick Start

```sh
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Configuration

By default, reads data from `~/.claude/`. Override with the `CLAUDE_DATA_PATH` environment variable:

```sh
CLAUDE_DATA_PATH=/path/to/claude/data npm run dev
```

## Tech Stack

- **SvelteKit 2** + **Svelte 5** (runes) — filesystem routing, server load functions read JSONL directly
- **Tailwind CSS v4** — CSS-first config via `@theme` directive
- **shiki 3** — syntax highlighting for code blocks
- **marked** — markdown rendering
- **TypeScript** — throughout
- **Zero database** — reads JSONL files directly from disk

## Architecture

```
src/
├── lib/
│   ├── types.ts                     # Shared TypeScript interfaces
│   ├── server/
│   │   ├── paths.ts                 # Data root resolution (~/.claude or env override)
│   │   ├── projects.ts              # Project listing, dir name parsing
│   │   ├── sessions.ts              # Session index reading, JSONL fallback scanning
│   │   ├── messages.ts              # JSONL stream parser, threading, tool pairing
│   │   └── search.ts               # Two-phase search engine
│   └── components/
│       ├── Sidebar.svelte           # Project navigation
│       ├── TopBar.svelte            # Breadcrumbs + search bar
│       ├── ProjectCard.svelte       # Project summary card
│       ├── MessageThread.svelte     # Conversation renderer
│       ├── UserMessage.svelte       # User message bubble
│       ├── AssistantMessage.svelte  # Assistant message block
│       ├── ToolUseBlock.svelte      # Collapsible tool call + result
│       ├── ThinkingBlock.svelte     # Collapsible thinking block
│       ├── MarkdownContent.svelte   # Markdown → HTML with code extraction
│       └── CodeBlock.svelte         # Syntax-highlighted code via shiki
├── routes/
│   ├── +layout.svelte               # Root layout: sidebar + top bar
│   ├── +layout.server.ts            # Load project list
│   ├── +page.svelte                 # Home → project grid
│   ├── projects/[projectId]/        # Session list for a project
│   ├── session/[projectId]/[sessionId]/ # Message viewer
│   ├── search/                      # Search results page
│   └── api/search/                  # JSON API for search
└── app.css                          # Tailwind v4 imports + theme
```

## Data Model

- **Projects**: Directories under `~/.claude/projects/` named by path slug
- **Sessions**: UUID-named `.jsonl` files; metadata indexed in `sessions-index.json`
- **Records**: JSONL lines with types: `user`, `assistant`, `summary`, `progress`, `system`
- **Threading**: Messages linked via `uuid`/`parentUuid` chain
- **Tool pairing**: `tool_use` blocks in assistant messages match `tool_result` blocks in user messages via `tool_use_id`

## Scripts

```sh
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build
npm run check        # TypeScript checking
npm run lint         # ESLint
npm run lint:fix     # ESLint with auto-fix
```

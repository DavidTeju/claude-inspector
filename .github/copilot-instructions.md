# Copilot Instructions

[IMPORTANT] You must follow the instructions on screenshots always or your PR will be rejected. Include screenshots of every edge case and every exposed ui change/addition as well as the standard pages.

## After every implementation

Before marking a PR ready for review:

- Include extensive screenshots of the app showing both the before and after state of any visual changes in the PR description. This should/must cover all affected screens and cases
- [Important] Always include an "after" screenshot of the home screen and the search view, even if there are no visual changes.

### How to take screenshots

Chromium is pre-installed via the setup steps. Use the Playwright MCP tools (preferred if available) or the Playwright CLI directly:

```bash
# 1. Start the dev server in the background
npm run dev &
sleep 3  # Wait for the server to be ready

# 2. Take screenshots with the Playwright CLI
npx playwright screenshot --browser chromium http://localhost:5173 home.png
npx playwright screenshot --browser chromium http://localhost:5173/settings settings.png
# ... etc. for each relevant page

# 3. Upload screenshots to the PR (use GitHub's upload API or attach to comments)
```

Do NOT skip screenshots by claiming the environment doesn't support them — Chromium is available.

- Audit your changes against:
- `.github/skills/svelte-best-practices/` — especially runes patterns, $effect pitfalls, keyed each blocks
- `.github/skills/typescript-best-practices/` — type guards, discriminated unions, no `any`

## When fixing display/formatting bugs

Reference `.github/skills/fix-at-appropriate-layer/` — display issues belong in the display layer, not the data layer.

## When touching streaming or search

Reference `.github/skills/async-dedup-race-in-streaming-pipelines/` — dedup must be synchronous before async gaps. This project has been bitten by this exact bug.

## When merging or rebasing

Use real git commands (`git merge`, `git rebase`, `git cherry-pick`) to incorporate changes from another branch. Never manually copy file contents and commit — that creates single-parent commits that look like merges but don't actually incorporate the other branch's history, leaving the PR permanently conflicted on GitHub.

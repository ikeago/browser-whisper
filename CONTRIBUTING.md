# Contributing to browser-whisper

Thanks for helping out! Bug reports, docs fixes, examples, and code are all welcome.

## Setup

Requires [Bun](https://bun.sh).

```bash
git clone https://github.com/tanpreetjolly/browser-whisper.git
cd browser-whisper
bun install
bun run dev:site   # landing page, docs, demo and examples at http://localhost:5173
```

## Checks

Run these before opening a PR:

```bash
bun run typecheck   # tsc --noEmit
bun test            # unit tests (src/tests)
bun run build       # library build + type declarations
bun run build:site  # site build (landing, docs, demo, examples)
```

## COOP/COEP

The library needs `SharedArrayBuffer`, so every page that loads it must be served with:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

The Vite configs and `vercel.json` already set these. If you add a new page or example, make sure it does too.

## Pull requests

- Keep PRs small and focused; one change per PR.
- Describe what changed and how you tested it (browser, OS, GPU / WebAssembly fallback, model).
- Add or update tests in `src/tests` for logic changes.
- Update `README.md`, `docs/index.html`, and `CHANGELOG.md` when behaviour or the public API changes.
- Make sure all checks above pass.

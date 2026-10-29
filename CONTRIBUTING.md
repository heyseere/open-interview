# Contributing to Open Interview

Thanks for your interest in contributing! This guide takes you from clone to a mergeable PR.

## Development setup

- Node.js 22+ and npm
- `npm install` (postinstall runs `electron-builder install-app-deps`)
- `npm run dev` starts the dev app
- Local voice transcription (optional, only if you work on that area): `brew install whisper.cpp` on macOS, or use the app's one-click setup in Settings → Voice transcription

## Verification gates

Every PR must pass all of these locally — CI runs the same set:

```bash
npm run typecheck    # tsc for both node and web configs
npm run lint         # ESLint, zero warnings
npm test             # vitest
npm run build:local  # package the app locally
npm run smoke        # boot the packaged app and assert no startup errors
```

## Project conventions

These keep reviews fast; PRs that ignore them will be asked to change:

- **i18n**: all user-facing strings live in `src/shared/i18n`, and every line must provide **both `zh` and `en`**. No hardcoded copy in components; shortcuts render through `<ActionShortcut>`, never literal key names.
- **Styling**: one dark glass theme. Design tokens are defined once in `src/renderer/src/assets/base.css` (`@theme`) and composed in `src/renderer/src/lib/glass.ts` — use tokens (`veil`, `panel`, `well`, `ink`, `live`, …) instead of raw Tailwind grays/shadows in feature code.
- **Architecture**: `src/main` (Node side), `src/preload` (contextBridge API surface), `src/renderer/src` (React + Zustand). Pure logic in main is unit-tested (streaming ASR state machine, error classification, markdown chunking, …) — if you add state-machine-like code, add tests for it first.
- **Commits**: English, concise, imperative.

## Pull requests

1. Fork, then create a branch from `main`.
2. Keep PRs small and focused — one behavior change per PR.
3. Fill in the PR checklist.
4. By opening a PR you agree that your contribution is licensed under the project's [MIT License](LICENSE) (inbound = outbound).

## Reporting bugs

Open a [bug report](.github/ISSUE_TEMPLATE/bug_report.yml) with your platform (macOS/Windows), app version, steps to reproduce, and any console output. For security issues, see [SECURITY.md](SECURITY.md) — please don't open public issues for those.

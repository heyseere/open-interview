# Security Policy

## Reporting a vulnerability

Please use GitHub's **private vulnerability reporting** (Security → Report a vulnerability) instead of a public issue. Include the platform, app version, and a description — a reproduction is appreciated.

You can expect an initial response within a few days.

## Scope notes

- API keys are stored encrypted via Electron `safeStorage` (OS keychain) in the main process only; they never reach the renderer or disk in plaintext. The encryption path lives in `src/main/secure-settings.ts`.
- Voice recognition runs fully on-device: audio is handed to the local whisper process in memory and is never persisted or uploaded.
- The renderer ↔ main surface is the contextBridge API in `src/preload/index.ts`. Anything that lets the renderer read plaintext secrets or widens that surface is a vulnerability.

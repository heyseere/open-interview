/**
 * Shortcut registration outcome. Declared once because it crosses every
 * process boundary: main keeps the bookkeeping (src/main/shortcuts.ts), the
 * preload types the IPC report (src/preload/index.ts) and the renderer store
 * renders the conflict hint (lib/store/shortcuts.ts) — three surfaces that
 * must not drift apart on what one status string means.
 */

/** Registration outcome for one shortcut action. */
export const ShortcutStatus = {
  Registered: 'registered',
  Failed: 'failed',
  /** Shortcut is available to register but not registered. */
  Available: 'available'
} as const

export type ShortcutStatus = (typeof ShortcutStatus)[keyof typeof ShortcutStatus]

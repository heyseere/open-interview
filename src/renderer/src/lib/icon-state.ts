/**
 * Shared icon-button color states for the main window's dark surfaces
 * (header bar, hover toolbar, scroll rail, compact panel, dialog footers).
 *
 * States, one hue scale (values are the semantic tokens from base.css):
 * - unavailable: the action cannot fire right now (missing prerequisite,
 *   edge reached, operation in flight) — the palest gray, clearly inert
 * - idle: available and waiting — readable gray
 * - active: toggled on / in progress — blue (pair with ICON_ACTIVE_BG wash)
 * - dim: de-emphasized chrome (resize grip, copy button) — quiet until hovered
 * - danger: destructive affordance (error-row close)
 */
const ICON_UNAVAILABLE = 'text-ink-ghost'
const ICON_IDLE = 'text-ink-soft'
const ICON_ACTIVE = 'text-live'
const ICON_DIM = 'text-ink-faint/70'
const ICON_DANGER = 'text-bad'

/** Dim color pair WITHOUT button chrome — non-button affordances (resize grip). */
export const ICON_DIM_SOFT = 'text-ink-faint/70 transition-colors hover:text-ink-soft'

/** Translucent wash behind an ACTIVE button (toolbar toggles, armed rail). */
export const ICON_ACTIVE_BG = 'bg-live-wash'

/** Solid primary-action recipe (dialog submit) — DwellIconButton `primary`. */
export const ICON_PRIMARY =
  'bg-action text-white transition-colors hover:bg-live disabled:bg-action/40 disabled:text-white/60'

/** Shared hover/transition chrome; colors above ride on top of it. Callers
 * supply their own shape (rounded-full / rounded-md). */
const ICON_CHROME = 'cursor-pointer transition-colors hover:bg-hairline hover:text-live-soft'
const ICON_DIM_CHROME = 'cursor-pointer transition-colors hover:bg-hairline hover:text-ink-soft'
const ICON_DANGER_CHROME = 'cursor-pointer transition-colors hover:bg-bad/15 hover:text-bad-soft'

/**
 * Color classes for an icon button. `disabled` wins over everything (a
 * toggled action that is currently unusable still shows as unavailable).
 */
export function iconStateClass(options: {
  active?: boolean
  disabled?: boolean
  danger?: boolean
  dim?: boolean
}): string {
  const { active, disabled, danger, dim } = options
  const chrome = danger ? ICON_DANGER_CHROME : dim ? ICON_DIM_CHROME : ICON_CHROME
  const color = disabled
    ? ICON_UNAVAILABLE
    : danger
      ? ICON_DANGER
      : dim
        ? ICON_DIM
        : active
          ? ICON_ACTIVE
          : ICON_IDLE
  return `${chrome} ${color}`
}

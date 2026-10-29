/**
 * Pure validation for the persisted window bounds (userData/window-bounds.json).
 * `electron` is deliberately not imported — the logic stays unit-testable and
 * both the read and the write path share one definition of "usable bounds".
 */

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface DisplayArea {
  workArea: { x: number; y: number; width: number; height: number }
}

const MIN_WIDTH = 240
const MIN_HEIGHT = 64
/**
 * Minimum overlap with some display's work area for bounds to count as
 * visible. A window parked mostly offscreen (or at the Windows soft-hide
 * position) must not be restored or persisted.
 */
const MIN_VISIBLE_AREA = 160 * 120

function isFiniteBounds(value: unknown): value is WindowBounds {
  if (typeof value !== 'object' || value === null) return false
  const bounds = value as Record<string, unknown>
  return (
    typeof bounds.x === 'number' &&
    Number.isFinite(bounds.x) &&
    typeof bounds.y === 'number' &&
    Number.isFinite(bounds.y) &&
    typeof bounds.width === 'number' &&
    Number.isFinite(bounds.width) &&
    typeof bounds.height === 'number' &&
    Number.isFinite(bounds.height)
  )
}

function overlapArea(a: WindowBounds, b: { x: number; y: number; width: number; height: number }) {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return width > 0 && height > 0 ? width * height : 0
}

/**
 * Returns rounded bounds when the record is well-formed and visibly on at
 * least one display; null otherwise (caller falls back to the defaults).
 */
export function sanitizeWindowBounds(raw: unknown, displays: DisplayArea[]): WindowBounds | null {
  if (!isFiniteBounds(raw)) return null
  const bounds: WindowBounds = {
    x: Math.round(raw.x),
    y: Math.round(raw.y),
    width: Math.round(raw.width),
    height: Math.round(raw.height)
  }
  if (bounds.width < MIN_WIDTH || bounds.height < MIN_HEIGHT) return null
  if (displays.length === 0) return null
  const visible = displays.some(
    (display) => overlapArea(bounds, display.workArea) >= MIN_VISIBLE_AREA
  )
  return visible ? bounds : null
}

import { useSettingsStore } from '@/lib/store/settings'

/**
 * The shared hover-dwell rule: an action fires after `toolbarDwellMs` of
 * hovering, or immediately on click when the hover-trigger setting is off
 * (duration 0 = click-only). `cap` lets an urgent action (stop) bound its
 * dwell BELOW the configured one. Used by the header icons, the hover
 * toolbar and the scroll rail so the setting has exactly one implementation.
 */
export function useDwellMs(): (cap?: number) => number {
  const hoverTrigger = useSettingsStore((state) => state.toolbarHoverTrigger)
  const dwellMs = useSettingsStore((state) => state.toolbarDwellMs)
  return (cap?: number) => (hoverTrigger ? Math.min(cap ?? dwellMs, dwellMs) : 0)
}

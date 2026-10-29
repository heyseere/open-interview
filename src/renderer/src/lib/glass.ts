/**
 * Dark-glass surface recipes for the main window — one tier per elevation,
 * pick by role (lib/glass.ts + the @theme tokens in base.css are the only
 * places glass values live):
 * - CANVAS: the window-wide frosted sheet every layout root paints once;
 *   scrolling happens inside it, so the desktop blur is computed once
 * - GLASS_OVERLAY: thin overlays riding on content (hover toolbar, scroll
 *   rail, inline controls) — no shadow of their own
 * - GLASS_CARD: dark floating cards over the canvas (shortcut tip)
 * - GLASS_MODAL: modal surfaces (dialogs, dropdown panels)
 * - PANEL: raised content panel on the canvas (section cards, compact
 *   panel) — white wash + shadow, deliberately borderless
 * - GLASS_WELL: recessed wells inside a panel (help frames, status lists,
 *   preset tiles)
 *
 * Every blur tier carries backdrop-saturate-150 (macOS vibrancy keeps colors
 * from washing out behind the blur) and its elevation shadow.
 */
export const CANVAS = 'bg-canvas backdrop-blur-xl backdrop-saturate-150'
export const GLASS_OVERLAY = 'bg-veil backdrop-blur-sm backdrop-saturate-150'
export const GLASS_CARD = 'bg-veil-2 backdrop-blur-sm backdrop-saturate-150 shadow-card'
export const GLASS_MODAL = 'bg-veil-3 backdrop-blur-md backdrop-saturate-150 shadow-modal'
export const PANEL = 'bg-panel shadow-card'
export const GLASS_WELL = 'bg-black/20 border border-hairline'

/** The one glass border (also the hover-wash hue — see icon-state ICON_CHROME). */
export const GLASS_BORDER = 'border border-hairline'

/**
 * DOM id of the window's canvas root (exactly one layout is mounted at a
 * time). Portal surfaces mount INSIDE it so they inherit the window opacity
 * and can blur the page behind them — see ui/dialog.tsx for why a portal on
 * document.body cannot do either.
 */
export const CANVAS_ID = 'app-canvas'

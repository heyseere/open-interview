/**
 * Scroll geometry shared by the scroll rail, the global page-turn shortcuts
 * and their tests.
 *
 * The rail both decides WHETHER to exist ("can this page scroll at all?") and
 * which of its four buttons are usable at each end of the range. Both answers
 * come from this one function so the thresholds cannot drift apart, and the
 * rules stay unit-testable without a DOM.
 */

/** Content must overflow by more than this before a rail is worth showing. */
const SCROLLABLE_EPSILON = 4
/** Distance from an edge that still counts as "at the edge" (sub-pixel slop). */
const EDGE_EPSILON = 1
/** Fraction of the viewport moved by one page step (rail click + shortcuts). */
const PAGE_FRACTION = 0.8

export interface ScrollMetrics {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}

export interface ScrollState {
  /** The content overflows its box: scroll buttons make sense. */
  scrollable: boolean
  atTop: boolean
  atBottom: boolean
}

export function measureScrollState({
  scrollTop,
  scrollHeight,
  clientHeight
}: ScrollMetrics): ScrollState {
  return {
    scrollable: scrollHeight - clientHeight > SCROLLABLE_EPSILON,
    atTop: scrollTop <= EDGE_EPSILON,
    atBottom: scrollHeight - scrollTop - clientHeight <= EDGE_EPSILON
  }
}

/**
 * One smooth page step: 0.8 of the container's viewport. The single distance
 * behind BOTH page-turn surfaces — the scroll rail's click step and the
 * global page-up/down shortcuts — so the two cannot drift apart. The scroll
 * rail's dwell path (continuous rAF scrolling) does not go through here.
 */
export interface PageScrollable {
  scrollTop: number
  clientHeight: number
  scrollTo(options: { top: number; behavior: ScrollBehavior }): void
}

export function scrollByPage(container: PageScrollable, direction: -1 | 1): void {
  container.scrollTo({
    top: container.scrollTop + direction * container.clientHeight * PAGE_FRACTION,
    behavior: 'smooth'
  })
}

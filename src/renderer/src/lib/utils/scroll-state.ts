/**
 * Scroll geometry shared by the scroll rail and its tests.
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

/*
Maintained asset: one-card offer-carousel target math.
Canonical path: app/offer-carousel-nav.mjs.
Future consumer: OfferMenuTrack and the focused Node navigation test.
Activation: auto-load from app/offer-climax.tsx; execute via
`node --test tests/rendered-html.test.mjs`.
Behavioral check: the test walks 0..11 and 11..0 on realistic geometry whose
maxScrollLeft is below the last raw offsets, clamps only the physical target,
ignores a second step while pending, and treats one horizontal wheel gesture
as a single adjacent step.
Retirement: when the offer carousel is removed or its one-card contract is
intentionally replaced.
*/

/**
 * @param {number} scrollLeft
 * @param {readonly number[]} offsets
 * @returns {number}
 */
export function nearestOfferCardIndex(scrollLeft, offsets) {
  if (offsets.length === 0) return 0;

  let nearest = 0;
  let nearestDistance = Math.abs(offsets[0] - scrollLeft);

  for (let index = 1; index < offsets.length; index += 1) {
    const distance = Math.abs(offsets[index] - scrollLeft);
    if (distance < nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  }

  return nearest;
}

/**
 * @param {number} value
 * @param {number} maxScrollLeft
 * @returns {number}
 */
export function clampOfferScrollLeft(value, maxScrollLeft) {
  const ceiling =
    Number.isFinite(maxScrollLeft) && maxScrollLeft > 0 ? maxScrollLeft : 0;
  return Math.max(0, Math.min(ceiling, value));
}

/**
 * @param {{
 *   selectedIndex: number,
 *   offsets: readonly number[],
 *   direction: -1 | 1,
 *   maxScrollLeft: number,
 * }} input
 * @returns {{ index: number, scrollLeft: number }}
 */
export function adjacentOfferCardTarget({
  selectedIndex,
  offsets,
  direction,
  maxScrollLeft,
}) {
  if (offsets.length === 0) {
    return { index: 0, scrollLeft: 0 };
  }

  const currentIndex = Math.max(
    0,
    Math.min(offsets.length - 1, selectedIndex),
  );
  const nextIndex = Math.max(
    0,
    Math.min(offsets.length - 1, currentIndex + direction),
  );
  const rawScrollLeft = offsets[nextIndex] ?? 0;

  return {
    index: nextIndex,
    scrollLeft: clampOfferScrollLeft(rawScrollLeft, maxScrollLeft),
  };
}

/**
 * @typedef {{
 *   selectedIndex: number,
 *   scrollLeft: number,
 *   pendingIndex: number | null,
 *   offsets: readonly number[],
 *   maxScrollLeft: number,
 * }} OfferCarouselNavState
 */

/**
 * @param {OfferCarouselNavState} state
 * @param {-1 | 1} direction
 * @returns {{
 *   selectedIndex: number,
 *   scrollLeft: number,
 *   pendingIndex: number | null,
 * }}
 */
export function stepOfferCarousel(state, direction) {
  if (state.pendingIndex !== null) {
    return {
      selectedIndex: state.selectedIndex,
      scrollLeft: state.scrollLeft,
      pendingIndex: state.pendingIndex,
    };
  }

  const target = adjacentOfferCardTarget({
    selectedIndex: state.selectedIndex,
    offsets: state.offsets,
    direction,
    maxScrollLeft: state.maxScrollLeft,
  });

  if (target.index === state.selectedIndex) {
    return {
      selectedIndex: state.selectedIndex,
      scrollLeft: state.scrollLeft,
      pendingIndex: null,
    };
  }

  const moved = Math.abs(target.scrollLeft - state.scrollLeft) >= 0.5;

  return {
    selectedIndex: target.index,
    scrollLeft: target.scrollLeft,
    pendingIndex: moved ? target.index : null,
  };
}

/**
 * @param {Pick<OfferCarouselNavState, "selectedIndex" | "pendingIndex" | "offsets">} state
 * @param {number} scrollLeft
 * @returns {{ selectedIndex: number, pendingIndex: number | null }}
 */
export function resyncOfferCarouselFromUserScroll(state, scrollLeft) {
  if (state.pendingIndex !== null) {
    return {
      selectedIndex: state.selectedIndex,
      pendingIndex: state.pendingIndex,
    };
  }

  return {
    selectedIndex: nearestOfferCardIndex(scrollLeft, state.offsets),
    pendingIndex: null,
  };
}

export const offerWheelGestureIdleMs = 180;

/**
 * @param {number} deltaX
 * @param {number} deltaY
 * @returns {-1 | 0 | 1}
 */
export function offerWheelDirection(deltaX, deltaY) {
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return 0;
  if (Math.abs(deltaX) <= Math.abs(deltaY) || deltaX === 0) return 0;
  return deltaX > 0 ? 1 : -1;
}

/**
 * @param {{ gestureActive: boolean }} state
 * @param {{ deltaX: number, deltaY: number, ctrlKey?: boolean }} event
 * @returns {{
 *   capture: boolean,
 *   step: boolean,
 *   direction: -1 | 0 | 1,
 *   gestureActive: boolean,
 * }}
 */
export function offerWheelGestureDecision(state, event) {
  if (event.ctrlKey) {
    return {
      capture: false,
      step: false,
      direction: 0,
      gestureActive: state.gestureActive,
    };
  }

  const direction = offerWheelDirection(event.deltaX, event.deltaY);
  if (direction === 0) {
    return {
      capture: false,
      step: false,
      direction: 0,
      gestureActive: state.gestureActive,
    };
  }

  if (state.gestureActive) {
    return {
      capture: true,
      step: false,
      direction,
      gestureActive: true,
    };
  }

  return {
    capture: true,
    step: true,
    direction,
    gestureActive: true,
  };
}

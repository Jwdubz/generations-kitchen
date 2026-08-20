/*
Maintained asset: one master timebase for the poke-to-offer climax.
Canonical path: app/offer-climax-timeline.mjs.
Future consumer: OfferTransition and the focused Node climax tests.
Activation: imported by app/offer-climax.tsx and tests/rendered-html.test.mjs.
Behavioral check: every public visual scalar is a continuous sample of one
normalized progress value; phase boundaries keep value and first difference
continuous; exposure radius is monotonic and never retracts; field/ray
geometry is settled before exposure opacity materially clears; terminal
sample equals the static settled CSS state.
Retirement: when the offer climax is removed or its one-clock contract is
intentionally replaced.
*/

export const CLIMAX_DURATION_MS = 4270;

export const PHASE_MS = Object.freeze({
  shutter: 380,
  blackHold: 190,
  ignition: 600,
  whiteHold: 200,
  release: 1600,
  content: 1300,
});

export const ORIGIN = Object.freeze({ x: 0.5, y: 0.38 });

export const SETTLED_RAY_OPACITY = 0.74;
export const SETTLED_FIELD_CLIP = 140;
export const SETTLED_RAY_CLIP = 130;
export const CONTENT_Y_START = 1.1;
export const TERMINAL_EXPOSURE_RADIUS = 1;
export const EXPOSURE_OVERSCAN = 2.6;

const shutterEndMs = PHASE_MS.shutter;
const blackHoldEndMs = shutterEndMs + PHASE_MS.blackHold;
const whitePeakMs = blackHoldEndMs + PHASE_MS.ignition;
const releaseStartMs = whitePeakMs + PHASE_MS.whiteHold;
const fieldOwnMs = releaseStartMs + PHASE_MS.release;

export const PHASES = Object.freeze({
  start: 0,
  shutterCloseEnd: shutterEndMs / CLIMAX_DURATION_MS,
  blackHoldEnd: blackHoldEndMs / CLIMAX_DURATION_MS,
  whitePeak: whitePeakMs / CLIMAX_DURATION_MS,
  releaseStart: releaseStartMs / CLIMAX_DURATION_MS,
  fieldOwn: fieldOwnMs / CLIMAX_DURATION_MS,
  end: 1,
});

export const PHASE_BOUNDARIES = Object.freeze([
  PHASES.start,
  PHASES.shutterCloseEnd,
  PHASES.blackHoldEnd,
  PHASES.whitePeak,
  PHASES.releaseStart,
  PHASES.fieldOwn,
  PHASES.end,
]);

/**
 * @typedef {object} OfferClimaxSample
 * @property {number} progress
 * @property {number} shutter
 * @property {number} black
 * @property {number} ignition
 * @property {number} white
 * @property {number} whiteRadius
 * @property {number} field
 * @property {number} fieldClip
 * @property {number} fieldScale
 * @property {number} rays
 * @property {number} rayClip
 * @property {number} rayScale
 * @property {number} transient
 * @property {number} content
 * @property {number} chrome
 * @property {number} contentY
 * @property {number} compositor
 */

/** @type {Readonly<OfferClimaxSample>} */
export const START_SAMPLE = Object.freeze({
  progress: 0,
  shutter: 0,
  black: 0,
  ignition: 0,
  white: 0,
  whiteRadius: 0,
  field: 0,
  fieldClip: 0,
  fieldScale: 1,
  rays: 0,
  rayClip: 0,
  rayScale: 1,
  transient: 0,
  content: 0,
  chrome: 0,
  contentY: CONTENT_Y_START,
  compositor: 0,
});

/** @type {Readonly<OfferClimaxSample>} */
export const SETTLED_SAMPLE = Object.freeze({
  progress: 1,
  shutter: 1,
  black: 0,
  ignition: 0,
  white: 0,
  whiteRadius: TERMINAL_EXPOSURE_RADIUS,
  field: 1,
  fieldClip: SETTLED_FIELD_CLIP,
  fieldScale: 1,
  rays: SETTLED_RAY_OPACITY,
  rayClip: SETTLED_RAY_CLIP,
  rayScale: 1,
  transient: 0,
  content: 1,
  chrome: 1,
  contentY: 0,
  compositor: 0,
});

export const SAMPLE_RANGES = Object.freeze({
  progress: [0, 1],
  shutter: [0, 1],
  black: [0, 1],
  ignition: [0, 1],
  white: [0, 1],
  whiteRadius: [0, 1],
  field: [0, 1],
  fieldClip: [0, SETTLED_FIELD_CLIP],
  fieldScale: [1, 1],
  rays: [0, SETTLED_RAY_OPACITY],
  rayClip: [0, SETTLED_RAY_CLIP],
  rayScale: [1, 1],
  transient: [0, 1],
  content: [0, 1],
  chrome: [0, 1],
  contentY: [0, CONTENT_Y_START],
  compositor: [0, 1],
});

export const SAMPLE_KEYS = Object.freeze(Object.keys(SAMPLE_RANGES));

/**
 * @param {number} value
 * @returns {number}
 */
export function clamp01(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * Quintic Hermite / Perlin smootherstep. Value and first derivative are 0 at
 * both endpoints, so adjoining plateaus stay C1.
 * @param {number} t
 * @returns {number}
 */
export function smootherstep(t) {
  const u = clamp01(t);
  return u * u * u * (u * (u * 6 - 15) + 10);
}

/**
 * @param {number} value
 * @param {number} start
 * @param {number} end
 * @returns {number}
 */
export function unlerp(value, start, end) {
  if (end === start) return value >= end ? 1 : 0;
  return (value - start) / (end - start);
}

/**
 * 0 before start, 1 after end, smootherstep in between.
 * @param {number} progress
 * @param {number} start
 * @param {number} end
 * @returns {number}
 */
export function ramp(progress, start, end) {
  if (progress <= start) return 0;
  if (progress >= end) return 1;
  return smootherstep(unlerp(progress, start, end));
}

/**
 * @param {number} progress
 * @returns {OfferClimaxSample}
 */
export function sampleOfferClimax(progress) {
  if (typeof progress !== "number" || Number.isNaN(progress) || progress <= 0) {
    return { ...START_SAMPLE };
  }
  if (progress >= 1) {
    return { ...SETTLED_SAMPLE };
  }

  const t = progress;
  const shutter = ramp(t, PHASES.start, PHASES.shutterCloseEnd);
  const white = riseAndFall(
    t,
    PHASES.blackHoldEnd,
    PHASES.whitePeak,
    PHASES.releaseStart,
    PHASES.fieldOwn,
  );
  const black = riseAndFall(
    t,
    PHASES.start,
    PHASES.shutterCloseEnd,
    PHASES.releaseStart,
    PHASES.fieldOwn,
  );
  const whiteRadius = ramp(t, PHASES.blackHoldEnd, PHASES.whitePeak);
  const field = ramp(t, PHASES.whitePeak, PHASES.releaseStart);
  const content = ramp(t, PHASES.fieldOwn, PHASES.end);
  const shutterTerm = t < PHASES.shutterCloseEnd ? shutter : 0;

  return {
    progress: t,
    shutter,
    black,
    ignition: white,
    white,
    whiteRadius,
    field,
    fieldClip: field * SETTLED_FIELD_CLIP,
    fieldScale: 1,
    rays: field * SETTLED_RAY_OPACITY,
    rayClip: field * SETTLED_RAY_CLIP,
    rayScale: 1,
    transient: 0,
    content,
    chrome: content,
    contentY: CONTENT_Y_START * (1 - content),
    compositor: Math.max(shutterTerm, black, white),
  };
}

/**
 * Terminal radius 1 is the beyond-corners coverage hold. Opacity may fall
 * after this; radius may not.
 * @param {number} whiteRadius
 * @returns {boolean}
 */
export function exposureCoversFrame(whiteRadius) {
  return whiteRadius >= TERMINAL_EXPOSURE_RADIUS - 1e-12;
}

/**
 * Rise with zero-slope ends, hold, then fall with zero-slope ends.
 * @param {number} t
 * @param {number} riseStart
 * @param {number} riseEnd
 * @param {number} fallStart
 * @param {number} fallEnd
 * @returns {number}
 */
function riseAndFall(t, riseStart, riseEnd, fallStart, fallEnd) {
  if (t <= riseStart) return 0;
  if (t < riseEnd) return ramp(t, riseStart, riseEnd);
  if (t <= fallStart) return 1;
  if (t < fallEnd) return 1 - ramp(t, fallStart, fallEnd);
  return 0;
}

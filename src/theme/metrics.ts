// ─── Device metrics & global type scale ─────────────────────────────────────
// Circuit's type was originally tuned to fit an iPhone SE 2020 (375×667), the
// tightest device we support. On a modern phone that leaves a lot of glass
// unused and the text smaller than it needs to be. These helpers scale the
// shared typography tokens up on roomier devices without ever going *below*
// the SE-safe baseline.

import { Dimensions } from 'react-native';

/** iPhone SE 2020 — the tightest supported device; scale factor 1.0 here. */
export const BASE_WIDTH = 375;
export const BASE_HEIGHT = 667;

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
const shortEdge = Math.min(windowWidth, windowHeight);
const longEdge = Math.max(windowWidth, windowHeight);

/**
 * Global UI scale factor, 1.0 → 1.2.
 *
 * Width is weighted heaviest because it governs line length (growing type on a
 * narrow screen just causes wrapping), but height carries real weight too: a
 * taller phone is exactly where there's room for larger text. Clamped at the
 * bottom so nothing ever shrinks below the SE-tuned baseline, and at the top so
 * a tablet or a desktop browser window doesn't produce comically large chrome.
 */
export const uiScale = clamp(
  0.7 * (shortEdge / BASE_WIDTH) + 0.3 * (longEdge / BASE_HEIGHT),
  1,
  1.2
);

/** Scale a baseline (SE-tuned) font size to this device. */
export const scaleFont = (size: number) => Math.round(size * uiScale);

/** Devices with enough vertical room to spend on larger type in the timer. */
export const isTallDevice = longEdge >= 780;

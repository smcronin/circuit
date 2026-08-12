// ─── Deterministic text fitting ─────────────────────────────────────────────
// React Native's `adjustsFontSizeToFit` is iOS-only — it is a no-op on the web
// build Circuit actually runs on, which is why long exercise names used to
// either clip or overflow. These helpers pick a font size up front by
// estimating the wrapped line count, so the same result renders everywhere.
//
// The estimate is intentionally slightly pessimistic about character width:
// over-estimating picks a marginally smaller size, which is always safe, while
// under-estimating would overflow the container.

export interface FitTextOptions {
  /** Horizontal space the text may occupy, in points. */
  maxWidth: number;
  /** Vertical space the whole text block may occupy, in points. */
  maxHeight?: number;
  /** Hard cap on wrapped lines. */
  maxLines: number;
  /** Largest size to try — the "there's plenty of room" ideal. */
  maxFontSize: number;
  /** Smallest acceptable size before we give up and let the text clip. */
  minFontSize: number;
  /**
   * Average glyph advance as a fraction of font size. Barlow Condensed
   * uppercase sits around 0.46; 0.48 leaves a little slack for wide letters.
   */
  charWidthRatio?: number;
  /** Line height as a fraction of font size. */
  lineHeightRatio?: number;
}

export interface FitTextResult {
  fontSize: number;
  lineHeight: number;
  /** Lines the text is expected to wrap to at `fontSize`. */
  lines: number;
  /** True when even `minFontSize` did not fit — the caller should clip. */
  overflowed: boolean;
}

/**
 * Greedy word-wrap line count, mirroring how the platform breaks text: words
 * move to the next line whole, and a single word wider than the line is broken
 * across as many lines as it needs.
 */
function countWrappedLines(tokens: string[], maxChars: number): number {
  if (maxChars < 1) return Number.POSITIVE_INFINITY;

  let lines = 1;
  let used = 0;

  for (const token of tokens) {
    const len = token.length;
    const needsBreak = used > 0 && used + 1 + len > maxChars;

    if (used === 0 || needsBreak) {
      if (used > 0) lines += 1;
      used = len;
    } else {
      used += 1 + len;
    }

    // An over-long word spills onto extra lines of its own.
    if (used > maxChars) {
      const extra = Math.ceil(used / maxChars) - 1;
      lines += extra;
      used = used - extra * maxChars;
    }
  }

  return lines;
}

/**
 * Split on whitespace, then treat hyphens and slashes as break opportunities
 * the way the text engine does ("SINGLE-ARM" can wrap after the hyphen).
 */
function tokenize(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .flatMap((word) => {
      const parts = word.split(/(?<=[-/])/);
      return parts.length > 1 ? parts : [word];
    })
    .filter(Boolean);
}

/** Pick the largest font size at which `text` fits the given box. */
export function fitText(text: string, options: FitTextOptions): FitTextResult {
  const {
    maxWidth,
    maxHeight,
    maxLines,
    maxFontSize,
    minFontSize,
    charWidthRatio = 0.48,
    lineHeightRatio = 1.06,
  } = options;

  const ceiling = Math.max(minFontSize, Math.floor(maxFontSize));
  const floor = Math.max(1, Math.floor(minFontSize));
  const tokens = tokenize(text || '');

  if (tokens.length === 0 || maxWidth <= 0) {
    return {
      fontSize: ceiling,
      lineHeight: Math.round(ceiling * lineHeightRatio),
      lines: 1,
      overflowed: false,
    };
  }

  for (let size = ceiling; size >= floor; size -= 1) {
    const maxChars = Math.floor(maxWidth / (size * charWidthRatio));
    const lines = countWrappedLines(tokens, maxChars);
    if (lines > maxLines) continue;
    if (maxHeight !== undefined && lines * size * lineHeightRatio > maxHeight) continue;

    return {
      fontSize: size,
      lineHeight: Math.round(size * lineHeightRatio),
      lines,
      overflowed: false,
    };
  }

  return {
    fontSize: floor,
    lineHeight: Math.round(floor * lineHeightRatio),
    lines: maxLines,
    overflowed: true,
  };
}

/**
 * Width of a `TimerDigits` string in em units. Digits occupy a 0.56em slot and
 * colons a 0.3em slot, matching the fixed-width layout the clock renders with.
 */
export function timerDigitsEmWidth(text: string): number {
  return text.split('').reduce((total, ch) => total + (ch === ':' ? 0.3 : 0.56), 0);
}

/** Largest `TimerDigits` font size that keeps `text` inside `maxWidth`. */
export function fitTimerDigits(text: string, maxWidth: number, maxFontSize: number): number {
  const em = timerDigitsEmWidth(text);
  if (em <= 0) return maxFontSize;
  // The digit component rounds each slot up, so shave a little off the width.
  return Math.max(24, Math.floor(Math.min(maxFontSize, (maxWidth - 4) / em)));
}

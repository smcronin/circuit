// ─── Rate of Perceived Exertion helpers ─────────────────────────────────────
// One home for the RPE color banding and labels. Previously four screens each
// carried their own byte-identical copy of getRpeColor; a palette change had to
// land in four files or the same RPE rendered differently per screen.

import { colors } from '@/theme';

export function getRpeColor(value: number): string {
  if (value <= 3) return colors.success;
  if (value <= 6) return colors.warning;
  if (value <= 8) return colors.accent;
  return colors.error;
}

export function getRpeLabel(value: number): string {
  if (value <= 2) return 'Very Easy';
  if (value <= 4) return 'Easy';
  if (value <= 6) return 'Moderate';
  if (value <= 8) return 'Hard';
  return 'Maximum';
}

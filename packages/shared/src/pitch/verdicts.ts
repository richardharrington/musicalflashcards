export type VerdictState =
  | 'pending'
  | 'correct'
  | 'wrongOctave'
  | 'wrong'
  | 'missed'
  | 'restViolated';

// null = leave the glyph its default black
export const VERDICT_COLORS: Record<VerdictState, string | null> = {
  pending: null,
  correct: '#15803d',
  wrongOctave: '#d97706',
  wrong: '#dc2626',
  missed: '#9ca3af',
  restViolated: '#dc2626',
};

// practice mode's current-target highlight
export const CURSOR_COLOR = '#2563eb';

export const verdictColor = (verdict: VerdictState, isCursor = false): string | null =>
  VERDICT_COLORS[verdict] ?? (isCursor ? CURSOR_COLOR : null);

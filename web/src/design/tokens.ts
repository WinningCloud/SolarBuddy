// Single source of truth for design tokens.
// tailwind.config.ts turns `palette` into CSS variables on :root (--c-<name>) and maps every
// Tailwind colour to those variables. Charts and SVG import the hex values from here directly.
//
// Contrast notes (WCAG AA, 4.5:1 for text under 18px):
// - accent #3395FF is 3.0:1 on white. It is used only for focus rings, selected borders,
//   chart series and icons (3:1 non-text rule). Text on blue fills uses `primary` (4.9:1).
// - The *-ink shades are the text colours for each status; the plain status colours are
//   for icons, bars and borders.

export const palette = {
  // Brand
  navy: '#072654',
  'navy-hover': '#0E3470',
  'navy-muted': '#B8C4D9',
  accent: '#3395FF',
  primary: '#1A6FD9',
  'primary-hover': '#165FBC',
  'primary-pressed': '#124F9E',
  tint: '#EAF3FF',

  // Surfaces and lines
  page: '#F5F7FA',
  surface: '#FFFFFF',
  line: '#E3E8EF',
  'line-strong': '#CBD3DF',
  'line-input': '#8A96A8',
  divider: '#EEF1F5',

  // Text
  ink: '#0D1B3E',
  'ink-2': '#516078',
  'ink-3': '#657186',
  'ink-disabled': '#8A96A8',

  // Status
  success: '#0E9F6E',
  'success-ink': '#087A55',
  'success-tint': '#E6F6EF',
  warning: '#B7791F',
  'warning-ink': '#8A5A12',
  'warning-tint': '#FFF4DB',
  danger: '#D64545',
  'danger-strong': '#C53A3A',
  'danger-ink': '#B42F2F',
  'danger-tint': '#FDECEC',

  // Decisions. Always shown with a text label, never colour alone.
  repair: '#3395FF',
  'repair-ink': '#1A6FD9',
  'repair-tint': '#EAF3FF',
  reuse: '#0E9F6E',
  'reuse-ink': '#087A55',
  'reuse-tint': '#E6F6EF',
  recycle: '#7A8AA6',
  'recycle-ink': '#44546F',
  'recycle-tint': '#EDF0F5',
} as const;

export type PaletteName = keyof typeof palette;

export const decisionColor = {
  repair: { solid: palette.repair, ink: palette['repair-ink'], tint: palette['repair-tint'] },
  reuse: { solid: palette.reuse, ink: palette['reuse-ink'], tint: palette['reuse-tint'] },
  recycle: { solid: palette.recycle, ink: palette['recycle-ink'], tint: palette['recycle-tint'] },
} as const;

export const fontFamily = {
  sans: [
    'Inter',
    'Noto Sans Tamil',
    'Noto Sans Devanagari',
    'system-ui',
    '-apple-system',
    'Segoe UI',
    'sans-serif',
  ],
  mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
};

// [size, line height]
export const fontSize = {
  '2xs': ['11px', '16px'],
  xs: ['12px', '16px'],
  sm: ['13px', '20px'],
  base: ['14px', '20px'],
  md: ['16px', '24px'],
  lg: ['20px', '28px'],
  xl: ['24px', '32px'],
  '2xl': ['32px', '40px'],
} as const;

export const radius = {
  none: '0',
  sm: '4px',
  btn: '6px',
  chip: '6px',
  card: '8px',
  control: '8px',
  full: '9999px',
} as const;

export const shadow = {
  card: '0 1px 2px rgba(7, 38, 84, 0.06)',
  overlay: '0 8px 24px rgba(7, 38, 84, 0.12), 0 1px 2px rgba(7, 38, 84, 0.06)',
  none: 'none',
} as const;

export const motion = {
  fast: '120ms',
  base: '160ms',
  slow: '200ms',
  easeOut: 'cubic-bezier(0.2, 0, 0, 1)',
} as const;

export const breakpoints = {
  xs: '360px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
} as const;

export function hexToChannels(hex: string): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

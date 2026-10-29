// Number formatting for the whole product: en-IN grouping (lakh/crore), ₹, and a
// narrow no-break space between value and unit so "312 W" never wraps mid-value.

export const UNIT_SPACE = ' ';
export const EMPTY_VALUE = '—';
const EN_DASH = '–';
const LOCALE = 'en-IN';

export type Unit = 'W' | 'kW' | 'V' | 'A' | 'Ω' | 'kg' | 'kWh' | 'MWh' | 'h' | 'W/m²' | '°C' | 'yr';

const defaultDigits: Record<Unit, number> = {
  W: 0,
  kW: 2,
  V: 1,
  A: 2,
  Ω: 2,
  kg: 1,
  kWh: 0,
  MWh: 2,
  h: 1,
  'W/m²': 0,
  '°C': 0,
  yr: 0,
};

const formatters = new Map<string, Intl.NumberFormat>();
function numberFormat(minDigits: number, maxDigits: number): Intl.NumberFormat {
  const key = `${minDigits}:${maxDigits}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
    });
    formatters.set(key, f);
  }
  return f;
}

function isNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** 123456.7 → "1,23,457" (digits = 0). */
export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (!isNumber(value)) return EMPTY_VALUE;
  return numberFormat(digits, digits).format(value);
}

/** formatUnit(312, 'W') → "312 W"; formatUnit(37.24, 'V') → "37.2 V". */
export function formatUnit(value: number | null | undefined, unit: Unit, digits?: number): string {
  if (!isNumber(value)) return EMPTY_VALUE;
  return `${formatNumber(value, digits ?? defaultDigits[unit])}${UNIT_SPACE}${unit}`;
}

/** formatUnitRange(10.2, 14.8, 'kg') → "10.2–14.8 kg". */
export function formatUnitRange(
  low: number | null | undefined,
  high: number | null | undefined,
  unit: Unit,
  digits?: number,
): string {
  if (!isNumber(low) || !isNumber(high)) return EMPTY_VALUE;
  const d = digits ?? defaultDigits[unit];
  if (formatNumber(low, d) === formatNumber(high, d)) return formatUnit(low, unit, d);
  return `${formatNumber(low, d)}${EN_DASH}${formatNumber(high, d)}${UNIT_SPACE}${unit}`;
}

/** formatInr(123456) → "₹1,23,456"; negative values keep the sign before the symbol. */
export function formatInr(value: number | null | undefined, digits = 0): string {
  if (!isNumber(value)) return EMPTY_VALUE;
  const sign = value < 0 ? '−' : '';
  return `${sign}₹${formatNumber(Math.abs(value), digits)}`;
}

/** Short form for tiles: 245000 → "₹2.45 lakh", 31000000 → "₹3.1 crore". */
export function formatInrCompact(value: number | null | undefined): string {
  if (!isNumber(value)) return EMPTY_VALUE;
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 1e7) return `${sign}₹${formatNumber(abs / 1e7, abs >= 1e8 ? 1 : 2)}${UNIT_SPACE}crore`;
  if (abs >= 1e5) return `${sign}₹${formatNumber(abs / 1e5, abs >= 1e6 ? 1 : 2)}${UNIT_SPACE}lakh`;
  return formatInr(value);
}

/** formatInrRange(1200, 2400) → "₹1,200–₹2,400". */
export function formatInrRange(
  low: number | null | undefined,
  high: number | null | undefined,
): string {
  if (!isNumber(low) || !isNumber(high)) return EMPTY_VALUE;
  if (Math.round(low) === Math.round(high)) return formatInr(low);
  return `${formatInr(low)}${EN_DASH}${formatInr(high)}`;
}

/** formatPercent(0.54) → "54%". Input is a fraction. */
export function formatPercent(fraction: number | null | undefined, digits = 0): string {
  if (!isNumber(fraction)) return EMPTY_VALUE;
  return `${formatNumber(fraction * 100, digits)}%`;
}

/** formatPercentRange(0.62, 0.85) → "62–85%". */
export function formatPercentRange(
  low: number | null | undefined,
  high: number | null | undefined,
  digits = 0,
): string {
  if (!isNumber(low) || !isNumber(high)) return EMPTY_VALUE;
  return `${formatNumber(low * 100, digits)}${EN_DASH}${formatNumber(high * 100, digits)}%`;
}

const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const dateTimeFormat = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** "29 Oct 2026" */
export function formatDate(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined) return EMPTY_VALUE;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? EMPTY_VALUE : dateFormat.format(date);
}

/** "29 Oct 2026, 02:15 pm" */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined) return EMPTY_VALUE;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? EMPTY_VALUE : dateTimeFormat.format(date);
}

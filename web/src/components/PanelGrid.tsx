import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import type { DamageFlag, DamageType } from '@/lib/types';
import { GRID_COLS, GRID_ROWS } from '@/lib/demo/twin';

/** Damage types that can be located on individual cells. */
export const CELL_TYPES: DamageType[] = ['cracked_cell', 'hot_spot', 'delamination'];

const LETTER: Partial<Record<DamageType, string>> = {
  cracked_cell: 'C',
  hot_spot: 'H',
  delamination: 'D',
};

interface PanelGridProps {
  flags: DamageFlag[];
  /** Accessible name for the grid. */
  label: string;
  onCellClick?: (row: number, col: number) => void;
  selected?: { row: number; col: number } | null;
  /** Cells that can be tapped are highlighted on hover. */
  interactive?: boolean;
  /** Draw over a photo: no panel background, light cell outlines. */
  overlay?: boolean;
  className?: string;
}

/**
 * The 60-cell panel diagram, 6 rows by 10 columns, drawn as a grid of real buttons.
 * Damage is shown with a letter and a heavier border, so colour is never the only signal.
 */
export function PanelGrid({
  flags,
  label,
  onCellClick,
  selected,
  interactive = true,
  overlay,
  className,
}: PanelGridProps) {
  const { t } = useTranslation();
  const byCell = new Map<string, DamageFlag[]>();
  for (const f of flags)
    for (const c of f.cells) {
      const key = `${c.row}:${c.col}`;
      byCell.set(key, [...(byCell.get(key) ?? []), f]);
    }

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'grid gap-[3px]',
        overlay ? 'p-1' : 'rounded-card border border-line bg-page p-2',
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: GRID_ROWS * GRID_COLS }, (_, n) => {
        const row = Math.floor(n / GRID_COLS);
        const col = n % GRID_COLS;
        const hits = byCell.get(`${row}:${col}`) ?? [];
        const isSelected = selected?.row === row && selected.col === col;
        const damaged = hits.length > 0;
        const first = hits[0];
        const name = `${t('inspect.cellLabel', { row: row + 1, col: col + 1 })}${
          damaged ? `: ${hits.map((h) => t(`damage.${h.type}`)).join(', ')}` : ''
        }`;
        return (
          <button
            key={n}
            type="button"
            disabled={!interactive || !onCellClick}
            onClick={() => onCellClick?.(row, col)}
            aria-label={name}
            aria-pressed={onCellClick ? isSelected || damaged : undefined}
            className={cn(
              'relative flex aspect-square min-h-[28px] items-center justify-center rounded-sm border text-xs font-semibold',
              'transition-colors duration-fast disabled:cursor-default',
              damaged
                ? cn(
                    'border-2 border-warning text-warning-ink',
                    overlay ? 'bg-warning-tint/70' : 'bg-warning-tint',
                  )
                : overlay
                  ? 'border-white/70 bg-transparent text-transparent enabled:hover:border-accent'
                  : 'border-line-strong bg-tint text-transparent enabled:hover:border-accent',
              isSelected && 'outline outline-2 outline-offset-1 outline-accent',
            )}
          >
            {first ? LETTER[first.type] : null}
          </button>
        );
      })}
    </div>
  );
}

export function PanelGridLegend({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2', className)}>
      {CELL_TYPES.map((type) => (
        <li key={type} className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-sm border-2 border-warning bg-warning-tint text-xs font-semibold text-warning-ink">
            {LETTER[type]}
          </span>
          {t(`damage.${type}`)}
        </li>
      ))}
    </ul>
  );
}

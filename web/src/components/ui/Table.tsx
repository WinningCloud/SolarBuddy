import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Checkbox } from './Checkbox';
import { Skeleton } from './Skeleton';

export interface Column<T> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Makes the column sortable. Return null to sort the row last. */
  sortValue?: (row: T) => string | number | null | undefined;
  align?: 'left' | 'right';
  /** Tailwind width class, e.g. "w-32". */
  width?: string;
  /** Hide on narrow screens. */
  hideBelow?: 'md' | 'lg';
}

export type SortDirection = 'asc' | 'desc';
export interface SortState {
  columnId: string;
  direction: SortDirection;
}

interface DataTableProps<T> {
  /** Accessible table name, visually hidden. */
  caption: string;
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  /** Short row name used in checkbox labels, e.g. the panel ID. */
  getRowLabel?: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selectedIds?: ReadonlySet<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  loading?: boolean;
  loadingRows?: number;
  /** Rendered in place of rows when there are none (an EmptyState). */
  empty?: ReactNode;
  /** Scroll height for the body; the header stays visible. */
  maxHeight?: number | string;
  defaultSort?: SortState | null;
  className?: string;
}

const hideClasses = { md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' };

type SortValue = string | number | null | undefined;

function isMissing(value: SortValue): value is null | undefined | '' {
  return value === null || value === undefined || value === '';
}

/** Missing values sort last regardless of direction. */
function compareRows(a: SortValue, b: SortValue, direction: SortDirection): number {
  if (isMissing(a) || isMissing(b)) {
    if (isMissing(a) && isMissing(b)) return 0;
    return isMissing(a) ? 1 : -1;
  }
  const order =
    typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b), 'en-IN', { numeric: true, sensitivity: 'base' });
  return direction === 'asc' ? order : -order;
}

/** Dense data table with sortable columns, sticky header, optional row selection. */
export function DataTable<T>({
  caption,
  columns,
  rows,
  getRowId,
  getRowLabel,
  onRowClick,
  selectable,
  selectedIds,
  onSelectionChange,
  loading,
  loadingRows = 5,
  empty,
  maxHeight,
  defaultSort = null,
  className,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const [sort, setSort] = useState<SortState | null>(defaultSort);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.id === sort.columnId);
    if (!column?.sortValue) return rows;
    const getValue = column.sortValue;
    return [...rows].sort((a, b) => compareRows(getValue(a), getValue(b), sort.direction));
  }, [rows, columns, sort]);

  const selected = selectedIds ?? new Set<string>();
  const allIds = rows.map(getRowId);
  const selectedCount = allIds.filter((id) => selected.has(id)).length;
  const allSelected = rows.length > 0 && selectedCount === rows.length;

  function toggleAll() {
    onSelectionChange?.(allSelected ? new Set() : new Set(allIds));
  }
  function toggleRow(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange?.(next);
  }
  function toggleSort(column: Column<T>) {
    setSort((current) => {
      if (current?.columnId !== column.id) return { columnId: column.id, direction: 'asc' };
      if (current.direction === 'asc') return { columnId: column.id, direction: 'desc' };
      return null;
    });
  }
  function onRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, row: T) {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowClick?.(row);
    }
  }

  const colCount = columns.length + (selectable ? 1 : 0);
  const scrollable = maxHeight !== undefined;

  return (
    // A scrollable region must be keyboard-focusable so it can be scrolled without a mouse.
    <div
      className={cn('overflow-auto', className)}
      style={scrollable ? { maxHeight } : undefined}
      tabIndex={scrollable ? 0 : undefined}
      role={scrollable ? 'region' : undefined}
      aria-label={scrollable ? caption : undefined}
    >
      <table className="w-full border-separate border-spacing-0 text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {selectable ? (
              <th
                scope="col"
                className="sticky top-0 z-[1] w-10 bg-page px-3 shadow-[inset_0_-1px_0_rgb(var(--c-line))]"
              >
                <Checkbox
                  aria-label={t('ui.table.selectAll')}
                  checked={allSelected}
                  indeterminate={selectedCount > 0 && !allSelected}
                  onChange={toggleAll}
                  disabled={loading || rows.length === 0}
                />
              </th>
            ) : null}
            {columns.map((column) => {
              const active = sort?.columnId === column.id;
              const ariaSort = active
                ? sort.direction === 'asc'
                  ? 'ascending'
                  : 'descending'
                : undefined;
              const SortIcon = active
                ? sort.direction === 'asc'
                  ? ArrowUp
                  : ArrowDown
                : ChevronsUpDown;
              return (
                <th
                  key={column.id}
                  scope="col"
                  aria-sort={column.sortValue ? (ariaSort ?? 'none') : undefined}
                  className={cn(
                    'sticky top-0 z-[1] h-9 whitespace-nowrap bg-page px-3 text-xs font-medium text-ink-2',
                    'shadow-[inset_0_-1px_0_rgb(var(--c-line))]',
                    column.align === 'right' && 'text-right',
                    column.width,
                    column.hideBelow && hideClasses[column.hideBelow],
                  )}
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column)}
                      className={cn(
                        '-mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 hover:text-ink',
                        active && 'text-ink',
                        column.align === 'right' && 'flex-row-reverse',
                      )}
                    >
                      <span>{column.header}</span>
                      <SortIcon
                        className={cn('h-3.5 w-3.5', !active && 'text-ink-disabled')}
                        aria-hidden="true"
                      />
                      <span className="sr-only">
                        {active
                          ? t(
                              sort.direction === 'asc'
                                ? 'ui.table.sortedAscending'
                                : 'ui.table.sortedDescending',
                            )
                          : t('ui.table.sortBy', { column: column.header })}
                      </span>
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: loadingRows }, (_, i) => (
              <tr key={`loading-${i}`} aria-hidden="true">
                {selectable ? <td className="h-10 border-b border-divider px-3" /> : null}
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={cn(
                      'h-10 border-b border-divider px-3',
                      column.hideBelow && hideClasses[column.hideBelow],
                    )}
                  >
                    <Skeleton
                      className={cn('h-3.5', column.align === 'right' ? 'ml-auto w-14' : 'w-24')}
                    />
                  </td>
                ))}
              </tr>
            ))
          ) : sortedRows.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="border-b border-divider">
                {empty}
              </td>
            </tr>
          ) : (
            sortedRows.map((row) => {
              const id = getRowId(row);
              const isSelected = selected.has(id);
              const clickable = Boolean(onRowClick);
              return (
                // Clickable rows are focusable and open with Enter or Space.
                <tr
                  key={id}
                  onClick={clickable ? () => onRowClick?.(row) : undefined}
                  onKeyDown={clickable ? (e) => onRowKeyDown(e, row) : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  aria-selected={selectable ? isSelected : undefined}
                  className={cn(
                    'group text-base text-ink',
                    clickable && 'cursor-pointer',
                    isSelected ? 'bg-tint' : clickable && 'hover:bg-page',
                  )}
                >
                  {selectable ? (
                    <td
                      className="h-10 border-b border-divider px-3"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        aria-label={t('ui.table.selectRow', { id: getRowLabel?.(row) ?? id })}
                        checked={isSelected}
                        onChange={() => toggleRow(id)}
                      />
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={cn(
                        'h-10 whitespace-nowrap border-b border-divider px-3',
                        column.align === 'right' && 'text-right',
                        column.hideBelow && hideClasses[column.hideBelow],
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

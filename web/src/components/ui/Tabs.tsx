import {
  createContext,
  useContext,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';

export interface TabItem {
  value: string;
  label: ReactNode;
  count?: number;
  disabled?: boolean;
}

interface TabsContextValue {
  baseId: string;
  value: string;
}
const TabsContext = createContext<TabsContextValue | null>(null);

interface TabsProps {
  /** Accessible name for the tab list. */
  label: string;
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  children?: ReactNode;
  className?: string;
}

const tabId = (base: string, value: string) => `${base}-tab-${value}`;
const panelId = (base: string, value: string) => `${base}-panel-${value}`;

/** Tabs with automatic activation and roving focus (arrow keys, Home, End). */
export function Tabs({ label, items, value, onValueChange, children, className }: TabsProps) {
  const baseId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const enabled = items.filter((i) => !i.disabled);
    const current = enabled.findIndex((i) => i.value === value);
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (current + 1) % enabled.length;
    if (event.key === 'ArrowLeft') next = (current - 1 + enabled.length) % enabled.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = enabled.length - 1;
    if (next === null) return;
    event.preventDefault();
    const item = enabled[next];
    if (!item) return;
    onValueChange(item.value);
    refs.current[items.indexOf(item)]?.focus();
  }

  return (
    <TabsContext.Provider value={{ baseId, value }}>
      <div className={className}>
        <div
          role="tablist"
          aria-label={label}
          className="flex gap-1 overflow-x-auto border-b border-line"
        >
          {items.map((item, index) => {
            const selected = item.value === value;
            return (
              <button
                key={item.value}
                ref={(el) => {
                  refs.current[index] = el;
                }}
                type="button"
                role="tab"
                id={tabId(baseId, item.value)}
                aria-selected={selected}
                aria-controls={panelId(baseId, item.value)}
                tabIndex={selected ? 0 : -1}
                disabled={item.disabled}
                onClick={() => onValueChange(item.value)}
                onKeyDown={onKeyDown}
                className={cn(
                  '-mb-px inline-flex h-10 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-base',
                  'transition-colors duration-fast disabled:cursor-not-allowed disabled:text-ink-disabled',
                  selected
                    ? 'border-accent font-medium text-ink'
                    : 'border-transparent text-ink-2 hover:border-line-strong hover:text-ink',
                )}
              >
                {item.label}
                {item.count !== undefined ? (
                  <span
                    className={cn(
                      'rounded-chip px-1.5 text-xs font-medium',
                      selected ? 'bg-tint text-primary' : 'bg-divider text-ink-2',
                    )}
                  >
                    {item.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabPanel({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabPanel must be used inside Tabs');
  if (context.value !== value) return null;
  return (
    <div
      role="tabpanel"
      id={panelId(context.baseId, value)}
      aria-labelledby={tabId(context.baseId, value)}
      tabIndex={0}
      className={cn('pt-4', className)}
    >
      {children}
    </div>
  );
}

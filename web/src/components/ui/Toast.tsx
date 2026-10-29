import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import { cn } from '@/lib/cn';

type ToastTone = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

interface ToastStore {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, 'id'>) => string;
  dismiss: (id: string) => void;
}

let counter = 0;

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = `toast-${++counter}`;
    // Keep at most three on screen; the oldest goes first.
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }].slice(-3) }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

type ToastOptions = Pick<ToastItem, 'description' | 'action'>;

export const toast = {
  success: (title: string, options?: ToastOptions) =>
    useToastStore.getState().push({ tone: 'success', title, ...options }),
  error: (title: string, options?: ToastOptions) =>
    useToastStore.getState().push({ tone: 'error', title, ...options }),
  info: (title: string, options?: ToastOptions) =>
    useToastStore.getState().push({ tone: 'info', title, ...options }),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
};

const toneStyle: Record<ToastTone, { icon: LucideIcon; iconClass: string }> = {
  success: { icon: CheckCircle2, iconClass: 'text-success' },
  error: { icon: AlertCircle, iconClass: 'text-danger' },
  info: { icon: Info, iconClass: 'text-accent' },
};

const DURATION_MS: Record<ToastTone, number> = { success: 5000, info: 5000, error: 8000 };

function ToastView({ item }: { item: ToastItem }) {
  const { t } = useTranslation();
  const dismiss = useToastStore((s) => s.dismiss);
  const [paused, setPaused] = useState(false);
  const { icon: Icon, iconClass } = toneStyle[item.tone];

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => dismiss(item.id), DURATION_MS[item.tone]);
    return () => window.clearTimeout(timer);
  }, [paused, item.id, item.tone, dismiss]);

  return (
    <li
      role={item.tone === 'error' ? 'alert' : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex animate-fade-in items-start gap-3 rounded-card border border-line bg-surface px-4 py-3 shadow-overlay"
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconClass)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium text-ink">{item.title}</p>
        {item.description ? <p className="mt-0.5 text-sm text-ink-2">{item.description}</p> : null}
        {item.action ? (
          <button
            type="button"
            onClick={() => {
              item.action?.onClick();
              dismiss(item.id);
            }}
            className="mt-1.5 rounded-sm text-sm font-medium text-primary hover:underline"
          >
            {item.action.label}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => dismiss(item.id)}
        aria-label={t('ui.dismiss')}
        className="-m-1 rounded-btn p-1 text-ink-3 hover:bg-divider hover:text-ink"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </li>
  );
}

/** Mount once at the app root. The live region always exists so announcements are reliable. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] md:left-auto md:right-6 md:w-[380px]"
    >
      <ol className="flex flex-col gap-2">
        {toasts.map((item) => (
          <ToastView key={item.id} item={item} />
        ))}
      </ol>
    </div>
  );
}

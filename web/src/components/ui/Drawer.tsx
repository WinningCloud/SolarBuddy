import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** right: detail panels on desktop. bottom: sheets on phones. */
  side?: 'right' | 'bottom';
  size?: 'md' | 'lg';
}

const rightWidths = { md: 'md:max-w-[480px]', lg: 'md:max-w-[640px]' };

export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = 'right',
  size = 'md',
}: DrawerProps) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-navy/40 data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed z-50 flex flex-col bg-surface shadow-overlay',
            side === 'right' && [
              'inset-y-0 right-0 w-full border-l border-line',
              'data-[state=closed]:animate-slide-out-right data-[state=open]:animate-slide-in-right',
              rightWidths[size],
            ],
            side === 'bottom' && [
              'inset-x-0 bottom-0 max-h-[85vh] rounded-t-card border-t border-line',
              'data-[state=closed]:animate-slide-out-down data-[state=open]:animate-slide-in-up',
            ],
          )}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          {side === 'bottom' ? (
            <span
              className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong"
              aria-hidden="true"
            />
          ) : null}
          <div className="flex items-start justify-between gap-4 border-b border-divider px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold text-navy">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-base text-ink-2">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              aria-label={t('ui.close')}
              className="-mr-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-btn text-ink-2 hover:bg-divider hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer ? (
            <div className="flex flex-wrap justify-end gap-2 border-t border-divider px-5 py-3">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

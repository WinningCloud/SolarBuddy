import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Action buttons, right-aligned. */
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const widths = { sm: 'max-w-[400px]', md: 'max-w-[560px]', lg: 'max-w-[760px]' };

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-navy/40 p-4',
            'data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in',
          )}
        >
          <Dialog.Content
            className={cn(
              'relative flex w-full flex-col rounded-card border border-line bg-surface shadow-overlay',
              'data-[state=closed]:animate-scale-out data-[state=open]:animate-scale-in',
              widths[size],
            )}
            // Without a description Radix needs an explicit undefined to skip the describedby link.
            {...(description ? {} : { 'aria-describedby': undefined })}
          >
            <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-5">
              <div className="min-w-0">
                <Dialog.Title className="text-lg font-semibold text-navy">{title}</Dialog.Title>
                {description ? (
                  <Dialog.Description className="mt-1 text-base text-ink-2">
                    {description}
                  </Dialog.Description>
                ) : null}
              </div>
              <Dialog.Close
                aria-label={t('ui.close')}
                className="-mr-1.5 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-btn text-ink-2 hover:bg-divider hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Dialog.Close>
            </div>
            {children ? <div className="px-5 py-3">{children}</div> : null}
            {footer ? (
              <div className="flex flex-wrap justify-end gap-2 border-t border-divider px-5 py-3">
                {footer}
              </div>
            ) : null}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

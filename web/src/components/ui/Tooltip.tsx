import type { ReactNode } from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import { cn } from '@/lib/cn';

export const TooltipProvider = RadixTooltip.Provider;

interface TooltipProps {
  content: ReactNode;
  /** Must be a single focusable element (button, link). */
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

/**
 * Short supplementary text on hover and keyboard focus. Not reachable by touch, so never put
 * essential information here; use SourceTag (popover) for sources.
 */
export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          collisionPadding={16}
          className={cn(
            'z-50 max-w-[260px] rounded-btn bg-navy px-2.5 py-1.5 text-sm text-white shadow-overlay',
            'data-[state=closed]:animate-fade-out data-[state=delayed-open]:animate-fade-in',
            className,
          )}
        >
          {content}
          <RadixTooltip.Arrow className="fill-navy" width={10} height={5} />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

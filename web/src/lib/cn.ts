import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      borderRadius: ['btn', 'chip', 'card', 'control'],
    },
    classGroups: {
      shadow: [{ shadow: ['card', 'overlay'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

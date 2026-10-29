import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';
import {
  breakpoints,
  fontFamily,
  fontSize,
  hexToChannels,
  motion,
  palette,
  radius,
  shadow,
} from './src/design/tokens';

const cssVariables = Object.fromEntries(
  Object.entries(palette).map(([name, hex]) => [`--c-${name}`, hexToChannels(hex)]),
);

const colors = Object.fromEntries(
  Object.keys(palette).map((name) => [name, `rgb(var(--c-${name}) / <alpha-value>)`]),
);

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: breakpoints,
    // Replace (not extend) so only system colours are available.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#FFFFFF',
      black: '#000000',
      ...colors,
    },
    fontFamily,
    fontSize: Object.fromEntries(
      Object.entries(fontSize).map(([k, [size, lineHeight]]) => [k, [size, { lineHeight }]]),
    ),
    fontWeight: { normal: '400', medium: '500', semibold: '600' },
    borderRadius: { ...radius, DEFAULT: radius.card },
    boxShadow: shadow,
    extend: {
      transitionDuration: { fast: motion.fast, DEFAULT: motion.base, slow: motion.slow },
      transitionTimingFunction: { DEFAULT: motion.easeOut, out: motion.easeOut },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.98)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'scale-out': {
          from: { opacity: '1', transform: 'scale(1)' },
          to: { opacity: '0', transform: 'scale(0.98)' },
        },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'none' } },
        'slide-out-right': { from: { transform: 'none' }, to: { transform: 'translateX(100%)' } },
        'slide-in-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        'slide-out-down': { from: { transform: 'none' }, to: { transform: 'translateY(100%)' } },
      },
      animation: {
        'fade-in': `fade-in ${motion.base} ${motion.easeOut}`,
        'fade-out': `fade-out ${motion.fast} ${motion.easeOut}`,
        'scale-in': `scale-in ${motion.base} ${motion.easeOut}`,
        'scale-out': `scale-out ${motion.fast} ${motion.easeOut}`,
        'slide-in-right': `slide-in-right ${motion.slow} ${motion.easeOut}`,
        'slide-out-right': `slide-out-right ${motion.base} ${motion.easeOut}`,
        'slide-in-up': `slide-in-up ${motion.slow} ${motion.easeOut}`,
        'slide-out-down': `slide-out-down ${motion.base} ${motion.easeOut}`,
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({ ':root': cssVariables });
    }),
  ],
} satisfies Config;

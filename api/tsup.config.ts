import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // The shared workspace package ships TypeScript source, so bundle it in.
  noExternal: [/^@secondsun\//],
});

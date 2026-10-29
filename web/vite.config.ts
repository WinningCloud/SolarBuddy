import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname, '..'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Shared with sim/: one copy of priors and assumptions.
      '@data': path.resolve(__dirname, '../data'),
    },
  },
  server: { port: 5173, fs: { allow: ['..'] } },
});

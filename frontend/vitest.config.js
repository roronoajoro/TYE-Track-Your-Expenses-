// vitest.config.js  ←  MUST live in the project root (next to package.json)
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Use jsdom to simulate a browser environment
    environment: 'jsdom',

    // Makes describe/it/expect available globally (needed by jest-dom)
    globals: true,

    // Bootstrap @testing-library/jest-dom matchers (toBeInTheDocument, etc.)
    setupFiles: ['./src/Test/setup.js'],

    // Pick up the test file wherever the user placed it
    include: ['src/Test/**/*.test.{js,jsx,ts,tsx}'],

    // Show every test name in the output
    reporters: ['verbose'],

    // Coverage (run with: node node_modules/vitest/vitest.mjs run --coverage)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx', 'src/Test/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

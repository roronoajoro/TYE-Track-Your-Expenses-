// vitest.config.js
// =================
// Vitest configuration for TYE's React frontend tests.
// Place this file in the project root (same level as package.json).

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Use jsdom to simulate a browser environment
    environment: 'jsdom',

    // Run this setup file before every test file
    setupFiles: ['./tests/frontend/setup.js'],

    // Glob pattern for test files
    include: ['tests/frontend/**/*.test.{js,jsx,ts,tsx}'],

    // Show each test name in the output (easier to read for your supervisor)
    reporters: ['verbose'],

    // Coverage settings (run with: npx vitest run --coverage)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx'],
    },
  },
  resolve: {
    alias: {
      // Match Vite's @ alias so imports like '@/components/...' resolve
      '@': path.resolve(__dirname, './src'),
      // Map bare component paths used in App.jsx
      './components/ParticleCanvas': path.resolve(
        __dirname, './src/components/ParticleCanvas.jsx'
      ),
      './pages/LandingPage': path.resolve(__dirname, './src/pages/LandingPage.jsx'),
      './pages/LoginPage':   path.resolve(__dirname, './src/pages/LoginPage.jsx'),
      './pages/Dashboard':   path.resolve(__dirname, './src/pages/Dashboard.jsx'),
    },
  },
});

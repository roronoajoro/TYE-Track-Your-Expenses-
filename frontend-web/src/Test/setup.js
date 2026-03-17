// tests/frontend/setup.js
// ========================
// Runs before every test file.  Extends Vitest's expect() with
// @testing-library/jest-dom matchers like toBeInTheDocument().

import '@testing-library/jest-dom';

// Suppress noisy console.error from React internals during tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('act(...)'))
    ) return;
    originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
});

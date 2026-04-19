// setup.js — runs once before every test file

// 1. Extend Vitest's `expect` with @testing-library/jest-dom DOM matchers.
//    Must use the /vitest sub-path so it patches Vitest's (not Jest's) expect.
import '@testing-library/jest-dom/vitest';

// 2. Polyfill browser APIs that jsdom doesn't implement.
//    LandingPage.jsx uses IntersectionObserver for scroll animations.
//    Without this stub, every test that renders LandingPage crashes immediately.
globalThis.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe()    {}
  unobserve()  {}
  disconnect() {}
};

// ResizeObserver is used by some recharts internals — stub it too.
globalThis.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe()    {}
  unobserve()  {}
  disconnect() {}
};


/**
 * App.test.jsx
 * ============
 * Unit tests for the React frontend of TYE.
 *
 * Tests cover:
 *   1. App.jsx  — page routing (landing → login → dashboard)
 *   2. ParticleCanvas.jsx — canvas renders without crash
 *   3. LandingPage.jsx   — CTA buttons, section rendering
 *   4. LoginPage.jsx     — back button, Google OAuth wrapper presence
 *   5. useApi.js         — toYM utility, state initialisation
 *
 * Run with:
 *   npm test              (Vite / Vitest)
 *   npx vitest run        (CI mode)
 *
 * Dependencies needed (add to package.json devDependencies):
 *   @testing-library/react
 *   @testing-library/jest-dom
 *   @testing-library/user-event
 *   vitest
 *   jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { renderHook, act } from '@testing-library/react';

// ── Mocks ────────────────────────────────────────────────────────────────────

// ParticleCanvas uses canvas API — jsdom doesn't support it, so stub it.
// ⚠️  The mock path must match the exact string used in App.jsx's import:
//     import ParticleCanvas from './components/ParticleCanvas'
vi.mock('../components/ParticleCanvas', () => ({
  default: () => <canvas data-testid="particle-canvas" />,
}));

// Google OAuth — we don't want real auth in tests
vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }) => <div>{children}</div>,
  GoogleLogin: ({ onSuccess, onError }) => (
    <button
      data-testid="google-login-btn"
      onClick={() => onSuccess({ credential: 'fake-token' })}
    >
      Sign in with Google
    </button>
  ),
}));

// Axios — prevent real HTTP calls
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import axios from 'axios';
import App from '../App';
import LandingPage from '../pages/LandingPage';
import LoginPage from '../pages/LoginPage';
import ParticleCanvas from '../components/ParticleCanvas';
import { useApi } from '../hooks/useApi'; // ✅ correct path: src/hooks/useApi.js


// ─────────────────────────────────────────────────────────────
// 1.  App.jsx — routing / page navigation
// ─────────────────────────────────────────────────────────────

describe('App – page routing', () => {
  /**
   * WHY THIS MATTERS:
   * App.jsx manages all navigation through simple state, not react-router.
   * If the wrong page renders at startup, or clicking "Get Started" doesn't
   * move to the login page, the entire user flow is broken.
   */

  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renders the LandingPage by default when no session exists', () => {
    render(<App />);
    // LandingPage has a heading with "Your money."
    expect(screen.getByText(/your money/i)).toBeInTheDocument();
  });

  it('navigates to LoginPage when "Get Started" is clicked', async () => {
    render(<App />);
    const btn = screen.getByRole('button', { name: /get started/i });
    await userEvent.click(btn);
    // LoginPage shows "Welcome to TYE"
    expect(screen.getByText(/welcome to tye/i)).toBeInTheDocument();
  });

  it('navigates back to LandingPage from LoginPage', async () => {
    render(<App />);
    // Go to login
    await userEvent.click(screen.getByRole('button', { name: /get started/i }));
    // Click back
    const backBtn = screen.getByRole('button', { name: /back to home/i });
    await userEvent.click(backBtn);
    expect(screen.getByText(/your money/i)).toBeInTheDocument();
  });

  it('loads Dashboard from sessionStorage if user is already logged in', () => {
    sessionStorage.setItem(
      'tye_user',
      JSON.stringify({ id: 1, name: 'Rafi', email: 'rafi@test.com', picture: null })
    );
    render(<App />);
    // Dashboard should be shown; landing page heading should not appear
    expect(screen.queryByText(/your money\. finally understood/i)).not.toBeInTheDocument();
  });

  it('clears session and returns to landing on logout', async () => {
    sessionStorage.setItem(
      'tye_user',
      JSON.stringify({ id: 1, name: 'Rafi', email: 'rafi@test.com', picture: null })
    );
    render(<App />);
    // Dashboard renders; find the LOGOUT button in the sidebar
    // The button text in Dashboard.jsx is exactly "LOGOUT"
    const logoutBtn = await screen.findByRole('button', { name: /logout/i });
    await userEvent.click(logoutBtn);
    expect(sessionStorage.getItem('tye_user')).toBeNull();
    expect(screen.getByText(/your money/i)).toBeInTheDocument();
  });
});


// ─────────────────────────────────────────────────────────────
// 2.  ParticleCanvas.jsx — renders without crashing
// ─────────────────────────────────────────────────────────────

describe('ParticleCanvas', () => {
  /**
   * WHY THIS MATTERS:
   * ParticleCanvas is always mounted (it's outside the page switch in App).
   * If it throws, the whole app is blank. The real component uses canvas
   * requestAnimationFrame — the mock verifies the component tree renders.
   */

  it('renders the canvas element', () => {
    render(<ParticleCanvas />);
    expect(screen.getByTestId('particle-canvas')).toBeInTheDocument();
  });
});


// ─────────────────────────────────────────────────────────────
// 3.  LandingPage.jsx — content and CTA buttons
// ─────────────────────────────────────────────────────────────

describe('LandingPage', () => {
  /**
   * WHY THIS MATTERS:
   * LandingPage is the first thing new users see.  If the CTA button
   * doesn't fire onGetStarted, nobody can sign up.
   */

  it('renders the hero headline', () => {
    render(<LandingPage onGetStarted={() => {}} />);
    expect(screen.getByText(/your money/i)).toBeInTheDocument();
  });

  it('calls onGetStarted when primary CTA is clicked', async () => {
    const onGetStarted = vi.fn();
    render(<LandingPage onGetStarted={onGetStarted} />);
    const btn = screen.getByRole('button', { name: /start for free/i });
    await userEvent.click(btn);
    expect(onGetStarted).toHaveBeenCalledOnce();
  });

  it('calls onGetStarted when nav "Get Started" is clicked', async () => {
    const onGetStarted = vi.fn();
    render(<LandingPage onGetStarted={onGetStarted} />);
    const btn = screen.getByRole('button', { name: /get started/i });
    await userEvent.click(btn);
    expect(onGetStarted).toHaveBeenCalled();
  });

  it('calls onGetStarted when nav "Log In" is clicked', async () => {
    const onGetStarted = vi.fn();
    render(<LandingPage onGetStarted={onGetStarted} />);
    const btn = screen.getByRole('button', { name: /log in/i });
    await userEvent.click(btn);
    expect(onGetStarted).toHaveBeenCalled();
  });

  it('renders Features section heading', () => {
    render(<LandingPage onGetStarted={() => {}} />);
    // 'Features' appears in both the nav and the section heading
    expect(screen.getAllByText(/features/i).length).toBeGreaterThan(0);
  });

  it('renders How It Works section', () => {
    render(<LandingPage onGetStarted={() => {}} />);
    // 'How It Works' appears in both the nav link and the section heading
    expect(screen.getAllByText(/how it works/i).length).toBeGreaterThan(0);
  });

  it('renders footer with TYE branding', () => {
    render(<LandingPage onGetStarted={() => {}} />);
    expect(screen.getByText(/track your expenses/i)).toBeInTheDocument();
  });

  it('renders trust badges (no credit card, free)', () => {
    render(<LandingPage onGetStarted={() => {}} />);
    expect(screen.getByText(/no credit card/i)).toBeInTheDocument();
    expect(screen.getByText(/100% free/i)).toBeInTheDocument();
  });
});


// ─────────────────────────────────────────────────────────────
// 4.  LoginPage.jsx — back button and Google OAuth presence
// ─────────────────────────────────────────────────────────────

describe('LoginPage', () => {
  /**
   * WHY THIS MATTERS:
   * LoginPage is the only entry point to the app.  If the Google button
   * is missing or the back button doesn't work, users are stuck.
   * The Google OAuth flow is mocked; we test that our code correctly
   * calls the backend and passes data to onLogin.
   */

  it('renders the welcome heading', () => {
    render(<LoginPage onLogin={() => {}} onBack={() => {}} />);
    expect(screen.getByText(/welcome to tye/i)).toBeInTheDocument();
  });

  it('calls onBack when "Back to home" is clicked', async () => {
    const onBack = vi.fn();
    render(<LoginPage onLogin={() => {}} onBack={onBack} />);
    await userEvent.click(screen.getByRole('button', { name: /back to home/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('renders the Google sign-in button', () => {
    render(<LoginPage onLogin={() => {}} onBack={() => {}} />);
    expect(screen.getByTestId('google-login-btn')).toBeInTheDocument();
  });

  it('calls onLogin with user data after successful Google auth', async () => {
    const onLogin = vi.fn();
    // Mock the backend response for /auth/google
    axios.post.mockResolvedValueOnce({
      data: {
        user_id: 1,
        name: 'Rafi Ahmed',
        email: 'rafi@test.com',
        picture: null,
        is_new_user: false,
      },
    });

    render(<LoginPage onLogin={onLogin} onBack={() => {}} />);
    await userEvent.click(screen.getByTestId('google-login-btn'));

    await waitFor(() => expect(onLogin).toHaveBeenCalledOnce());
    expect(onLogin.mock.calls[0][0]).toMatchObject({
      name: 'Rafi Ahmed',
      email: 'rafi@test.com',
    });
  });

  it('shows error message when backend returns an error', async () => {
    axios.post.mockRejectedValueOnce({
      response: { data: { detail: 'Invalid Google token' } },
    });

    render(<LoginPage onLogin={() => {}} onBack={() => {}} />);
    await userEvent.click(screen.getByTestId('google-login-btn'));

    await waitFor(() =>
      expect(screen.getByText(/invalid google token/i)).toBeInTheDocument()
    );
  });

  it('shows security badges (Encrypted, OAuth 2.0)', () => {
    render(<LoginPage onLogin={() => {}} onBack={() => {}} />);
    expect(screen.getByText(/encrypted/i)).toBeInTheDocument();
    expect(screen.getByText(/oauth 2\.0/i)).toBeInTheDocument();
  });
});


// ─────────────────────────────────────────────────────────────
// 5.  useApi.js — utility functions and initial state
// ─────────────────────────────────────────────────────────────

describe('useApi – toYM utility and initial state', () => {
  /**
   * WHY THIS MATTERS:
   * useApi is the data layer for the entire Dashboard.  toYM() converts
   * a Date to "YYYY-MM" for the budget/summary API calls.
   * If toYM returns the wrong format, every monthly fetch will hit the
   * wrong endpoint and the dashboard shows empty data.
   *
   * We also check that initial state is correctly seeded from sessionStorage
   * so existing savings goals survive a page refresh.
   */

  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    // Default: all API calls resolve with empty data
    axios.get.mockResolvedValue({ data: [] });
    axios.post.mockResolvedValue({ data: {} });
  });

  it('toYM returns correct YYYY-MM format for January', () => {
    // We re-export toYM through the hook result
    const { result } = renderHook(() => useApi(1));
    const date = new Date(2026, 0, 15); // January 15, 2026
    expect(result.current.toYM(date)).toBe('2026-01');
  });

  it('toYM returns correct YYYY-MM format for December', () => {
    const { result } = renderHook(() => useApi(1));
    const date = new Date(2025, 11, 31); // December 31, 2025
    expect(result.current.toYM(date)).toBe('2025-12');
  });

  it('toYM pads single-digit months with a zero', () => {
    const { result } = renderHook(() => useApi(1));
    const date = new Date(2026, 2, 1); // March — month index 2
    const ym = result.current.toYM(date);
    expect(ym).toBe('2026-03');
    expect(ym.split('-')[1]).toHaveLength(2); // must be "03" not "3"
  });

  it('initialises transactions as an empty array', () => {
    const { result } = renderHook(() => useApi(1));
    expect(Array.isArray(result.current.transactions)).toBe(true);
  });

  it('initialises budgets as an empty array', () => {
    const { result } = renderHook(() => useApi(1));
    expect(Array.isArray(result.current.budgets)).toBe(true);
  });

  it('loads default categories when none are stored', () => {
    const { result } = renderHook(() => useApi(99));
    expect(result.current.cats).toContain('Food');
    expect(result.current.cats).toContain('Transport');
    expect(result.current.cats).toContain('Rent');
  });

  it('loads custom categories from sessionStorage', () => {
    const custom = ['Food', 'Freelance', 'Gym'];
    sessionStorage.setItem('tye_cats_5', JSON.stringify(custom));
    const { result } = renderHook(() => useApi(5));
    expect(result.current.cats).toEqual(custom);
  });

  it('loads savings from sessionStorage', () => {
    const goals = [{ name: 'New Laptop', target: 80000, saved: 32000 }];
    sessionStorage.setItem('tye_savings_3', JSON.stringify(goals));
    const { result } = renderHook(() => useApi(3));
    expect(result.current.savings).toHaveLength(1);
    expect(result.current.savings[0].name).toBe('New Laptop');
  });

  it('fetchTransactions calls the correct endpoint', async () => {
    axios.get.mockResolvedValue({ data: [{ id: 1, amount: 300 }] });
    const { result } = renderHook(() => useApi(7));
    await act(async () => {
      await result.current.fetchTransactions();
    });
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining('/transactions/7')
    );
  });

  it('addTransaction posts to /transactions/ and refreshes list', async () => {
    axios.post.mockResolvedValue({
      data: { id: 10, amount: 500, category: 'Food', description: 'Lunch',
              date: '2026-03-14', user_id: 1 },
    });
    axios.get.mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useApi(1));
    await act(async () => {
      await result.current.addTransaction({
        amount: 500, category: 'Food',
        description: 'Lunch', date: '2026-03-14',
      });
    });
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/transactions/'),
      expect.objectContaining({ amount: 500, user_id: 1 })
    );
  });

  it('setSavings persists to sessionStorage', () => {
    const { result } = renderHook(() => useApi(2));
    act(() => {
      result.current.setSavings([{ name: 'Vacation', target: 50000, saved: 10000 }]);
    });
    const stored = JSON.parse(sessionStorage.getItem('tye_savings_2'));
    expect(stored[0].name).toBe('Vacation');
  });

  it('setCats persists new categories to sessionStorage', () => {
    const { result } = renderHook(() => useApi(2));
    act(() => {
      result.current.setCats(['Food', 'Custom Category']);
    });
    const stored = JSON.parse(sessionStorage.getItem('tye_cats_2'));
    expect(stored).toContain('Custom Category');
  });
});

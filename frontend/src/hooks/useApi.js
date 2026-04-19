/**
 * useApi — central data hook for Taka Gelo Koi
 * Connects Dashboard to all FastAPI backend routes.
 * Includes: Transactions, Budgets, Income, Goals, GoalAllocations,
 *           SavingsTransfers, Loans, LoanPayments, AutoAllocate
 */
import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

function toYM(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function useApi(userId) {
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets]           = useState([]);
  const [summary, setSummary]           = useState({ total_spent: 0, breakdown: {} });

  // Income
  const [incomes, setIncomes]                   = useState([]);
  const [incomeSummary, setIncomeSummary]       = useState({
    total_income: 0, total_spent: 0, savings: 0,
    source_breakdown: {}, carried_forward: 0, net_savings: 0
  });

  // Goals
  const [goals, setGoals]                       = useState([]);
  const [achievedGoals, setAchievedGoals]       = useState([]);
  const [goalAllocations, setGoalAllocations]   = useState([]);

  // Savings
  const [savingsTransfers, setSavingsTransfers] = useState([]);
  const [totalSavingsPool, setTotalSavingsPool] = useState({
    total_pooled: 0, spent_on_goals_from_savings: 0,
    spent_on_loans_from_savings: 0, net_savings_pool: 0
  });

  // Loans
  const [loans, setLoans]               = useState([]);
  const [loanPayments, setLoanPayments] = useState([]);

  const [loading, setLoading] = useState(false);

  // Categories — stored in sessionStorage (no backend)
  const [cats, setCatsRaw] = useState(() => {
    try {
      const stored = sessionStorage.getItem(`tgk_cats_${userId}`);
      return stored ? JSON.parse(stored)
        : ['Food', 'Transport', 'Rent', 'Utilities', 'Shopping', 'Entertainment'];
    } catch { return ['Food', 'Transport', 'Rent', 'Utilities', 'Shopping', 'Entertainment']; }
  });

  const setCats = useCallback(updater => {
    setCatsRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      sessionStorage.setItem(`tgk_cats_${userId}`, JSON.stringify(next));
      return next;
    });
  }, [userId]);

  // ── TRANSACTIONS ─────────────────────────────────────────────────────────────

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/transactions/${userId}`);
      setTransactions(res.data);
    } catch (e) { console.error('fetchTransactions', e); }
  }, [userId]);

  const fetchSummary = useCallback(async (month) => {
    const m = month || toYM(new Date());
    try {
      const res = await axios.get(`${API}/summary/${userId}?month=${m}`);
      setSummary(res.data);
    } catch (e) { console.error('fetchSummary', e); }
  }, [userId]);

  const fetchBudgets = useCallback(async (month) => {
    const m = month || toYM(new Date());
    try {
      const res = await axios.get(`${API}/budgets/${userId}/${m}`);
      setBudgets(res.data);
    } catch (e) { console.error('fetchBudgets', e); }
  }, [userId]);

  const addTransaction = useCallback(async ({ amount, category, description, date }) => {
    const res = await axios.post(`${API}/transactions/`, {
      amount: parseFloat(amount), category, description, date, user_id: userId,
    });
    await fetchTransactions();
    await fetchSummary(date.slice(0, 7));
    return res.data;
  }, [userId, fetchTransactions, fetchSummary]);

  const deleteTransaction = useCallback(async (id, month) => {
    await axios.delete(`${API}/transactions/${id}`);
    await fetchTransactions();
    if (month) await fetchSummary(month);
  }, [fetchTransactions, fetchSummary]);

  const updateTransaction = useCallback(async (id, fields, month) => {
    await axios.put(`${API}/transactions/${id}`, fields);
    await fetchTransactions();
    if (month) await fetchSummary(month);
  }, [fetchTransactions, fetchSummary]);

  const createBudget = useCallback(async ({ category, monthly_limit, month, alert_threshold }) => {
    const m = month || toYM(new Date());
    await axios.post(`${API}/budgets/?user_id=${userId}`, {
      category, monthly_limit: parseFloat(monthly_limit), month: m,
      alert_threshold: parseInt(alert_threshold) || 80, notifications_enabled: true,
    });
    await fetchBudgets(m);
  }, [userId, fetchBudgets]);

  const deleteBudget = useCallback(async (id, month) => {
    await axios.delete(`${API}/budgets/${id}`);
    await fetchBudgets(month || toYM(new Date()));
  }, [fetchBudgets]);

  const updateBudget = useCallback(async (id, fields, month) => {
    await axios.put(`${API}/budgets/${id}`, fields);
    await fetchBudgets(month || toYM(new Date()));
  }, [fetchBudgets]);

  const fetchMonthlyReport = useCallback(async (month) => {
    const res = await axios.get(`${API}/monthly-report/${userId}?month=${month}`);
    return res.data;
  }, [userId]);

  // ── INCOME ──────────────────────────────────────────────────────────────────

  const fetchIncomes = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/incomes/${userId}`);
      setIncomes(res.data);
    } catch (e) { console.error('fetchIncomes', e); }
  }, [userId]);

  const fetchIncomeSummary = useCallback(async (month) => {
    const m = month || toYM(new Date());
    try {
      const res = await axios.get(`${API}/income-summary/${userId}?month=${m}`);
      setIncomeSummary(res.data);
    } catch (e) { console.error('fetchIncomeSummary', e); }
  }, [userId]);

  const addIncome = useCallback(async ({ amount, source, description, date }) => {
    const res = await axios.post(`${API}/incomes/`, {
      amount: parseFloat(amount), source, description, date, user_id: userId,
    });
    await fetchIncomes();
    return res.data;
  }, [userId, fetchIncomes]);

  const deleteIncome = useCallback(async (id) => {
    await axios.delete(`${API}/incomes/${id}`);
    await fetchIncomes();
  }, [fetchIncomes]);

  const updateIncome = useCallback(async (id, fields) => {
    await axios.put(`${API}/incomes/${id}`, fields);
    await fetchIncomes();
  }, [fetchIncomes]);

  // ── GOALS ────────────────────────────────────────────────────────────────────

  const fetchGoals = useCallback(async () => {
    try {
      const [activeRes, achievedRes] = await Promise.all([
        axios.get(`${API}/goals/${userId}?status_filter=active`),
        axios.get(`${API}/goals/${userId}?status_filter=achieved`),
      ]);
      setGoals(activeRes.data);
      setAchievedGoals(achievedRes.data);
    } catch (e) { console.error('fetchGoals', e); }
  }, [userId]);

  const fetchGoalAllocations = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/goal-allocations/${userId}`);
      setGoalAllocations(res.data);
    } catch (e) { console.error('fetchGoalAllocations', e); }
  }, [userId]);

  const addGoal = useCallback(async (goalData) => {
    const res = await axios.post(`${API}/goals/`, { ...goalData, user_id: userId });
    await fetchGoals();
    return res.data;
  }, [userId, fetchGoals]);

  const updateGoal = useCallback(async (id, fields) => {
    await axios.put(`${API}/goals/${id}`, fields);
    await fetchGoals();
  }, [fetchGoals]);

  const deleteGoal = useCallback(async (id) => {
    await axios.delete(`${API}/goals/${id}`);
    await fetchGoals();
  }, [fetchGoals]);

  const allocateToGoal = useCallback(async ({ goal_id, amount, month, source, notes }) => {
    const res = await axios.post(`${API}/goal-allocations/`, {
      goal_id, user_id: userId,
      amount: parseFloat(amount),
      month, source, notes,
    });
    await fetchGoals();
    await fetchGoalAllocations();
    if (source === 'income') {
      await fetchTransactions();
      await fetchSummary(month);
    } else if (source === 'savings') {
      await fetchTotalSavings(); // refresh savings pool after deduction
    }
    return res.data;
  }, [userId, fetchGoals, fetchGoalAllocations, fetchTransactions, fetchSummary]); // fetchTotalSavings added below

  // ── SAVINGS ──────────────────────────────────────────────────────────────────

  const fetchTotalSavings = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/total-savings/${userId}`);
      setTotalSavingsPool(res.data);
    } catch (e) { console.error('fetchTotalSavings', e); }
  }, [userId]);

  const fetchSavingsTransfers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/savings-transfers/${userId}`);
      setSavingsTransfers(res.data);
    } catch (e) { console.error('fetchSavingsTransfers', e); }
  }, [userId]);

  const createSavingsTransfer = useCallback(async ({ amount, from_month, to_month, transfer_type, notes }) => {
    const res = await axios.post(`${API}/savings-transfers/`, {
      user_id: userId,
      amount: parseFloat(amount),
      from_month, to_month, transfer_type, notes,
    });
    await fetchSavingsTransfers();
    await fetchTotalSavings();
    return res.data;
  }, [userId, fetchSavingsTransfers, fetchTotalSavings]);

  // ── LOANS ────────────────────────────────────────────────────────────────────

  const fetchLoans = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/loans/${userId}`);
      setLoans(res.data);
    } catch (e) { console.error('fetchLoans', e); }
  }, [userId]);

  const fetchLoanPayments = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/loan-payments/${userId}`);
      setLoanPayments(res.data);
    } catch (e) { console.error('fetchLoanPayments', e); }
  }, [userId]);

  const addLoan = useCallback(async (loanData) => {
    const res = await axios.post(`${API}/loans/`, {
      ...loanData,
      user_id: userId,
      amount: parseFloat(loanData.amount),
    });
    await fetchLoans();
    return res.data;
  }, [userId, fetchLoans]);

  const deleteLoan = useCallback(async (id) => {
    await axios.delete(`${API}/loans/${id}`);
    await fetchLoans();
  }, [fetchLoans]);

  const addLoanPayment = useCallback(async (paymentData) => {
    const res = await axios.post(`${API}/loan-payments/`, {
      ...paymentData,
      user_id: userId,
      amount: parseFloat(paymentData.amount),
    });
    await fetchLoans();
    await fetchLoanPayments();
    if (paymentData.source === 'income') {
      await fetchTransactions();
      await fetchSummary(paymentData.month);
    } else {
      await fetchTotalSavings();
    }
    return res.data;
  }, [userId, fetchLoans, fetchLoanPayments, fetchTransactions, fetchSummary, fetchTotalSavings]);

  // ── AUTO-ALLOCATE ─────────────────────────────────────────────────────────────

  const checkUnallocatedSavings = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/check-unallocated-savings/${userId}`);
      return res.data;
    } catch (e) {
      console.error('checkUnallocatedSavings', e);
      return { unhandled_months: [] };
    }
  }, [userId]);

  const confirmAutoAllocate = useCallback(async (months) => {
    const res = await axios.post(`${API}/confirm-auto-allocate/${userId}`, { months });
    await fetchSavingsTransfers();
    await fetchTotalSavings();
    return res.data;
  }, [userId, fetchSavingsTransfers, fetchTotalSavings]);

  // ── INITIAL LOAD ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!userId) return;
    const m = toYM(new Date());
    fetchTransactions();
    fetchSummary(m);
    fetchBudgets(m);
    fetchIncomes();
    fetchIncomeSummary(m);
    fetchGoals();
    fetchGoalAllocations();
    fetchSavingsTransfers();
    fetchTotalSavings();
    fetchLoans();
    fetchLoanPayments();
  }, [userId]); // eslint-disable-line

  return {
    // data
    transactions, budgets, summary, loading,
    incomes, incomeSummary,
    goals, achievedGoals, goalAllocations,
    savingsTransfers, totalSavingsPool,
    loans, loanPayments,
    cats,
    // setters
    setCats,
    // fetchers
    fetchTransactions, fetchSummary, fetchBudgets, fetchMonthlyReport,
    fetchIncomes, fetchIncomeSummary,
    fetchGoals, fetchGoalAllocations,
    fetchSavingsTransfers, fetchTotalSavings,
    fetchLoans, fetchLoanPayments,
    // mutations
    addTransaction, deleteTransaction, updateTransaction,
    createBudget, deleteBudget, updateBudget,
    addIncome, deleteIncome, updateIncome,
    addGoal, updateGoal, deleteGoal, allocateToGoal,
    createSavingsTransfer,
    addLoan, deleteLoan, addLoanPayment,
    checkUnallocatedSavings, confirmAutoAllocate,
    // util
    toYM,
  };
}


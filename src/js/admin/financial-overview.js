// ============================================================
// ADMIN — Financial Overview
// ============================================================

import { db } from '../firebase-config.js';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { getCurrentUserData } from '../auth.js';
import { getDashboardLayout, initSidebar } from './dashboard.js';
import { formatCurrency, formatNumber, escapeHtml } from '../utils/validation.js';
import { formatDate, formatDateTime } from '../utils/date-utils.js';

export function renderFinancialOverview(container) {
  const user = getCurrentUserData();
  container.innerHTML = getDashboardLayout('financial', 'admin', user, `
    <div class="dashboard-header">
      <div><h1 class="page-title">Financial Overview</h1><div class="page-breadcrumb"><span>Admin</span><span class="separator">/</span><span class="current">Financial</span></div></div>
    </div>
    <div class="dashboard-content">
      <div class="financial-summary" id="fin-summary">
        <div class="summary-side">
          <div class="summary-card balance"><div class="summary-icon">💵</div><div class="summary-value" id="net-balance">₹0</div><div class="summary-label">Net Balance</div></div>
          <div class="summary-card pending"><div class="summary-icon">⏳</div><div class="summary-value" id="pending-verifications">0</div><div class="summary-label">Pending Verifications</div></div>
        </div>
        <div class="summary-card income">
          <div class="summary-icon">💰</div>
          <div class="summary-value" id="total-income">₹0</div>
          <div class="summary-label">Total Income</div>
          <div class="summary-breakdown" id="income-breakdown"></div>
        </div>
        <div class="summary-card expense">
          <div class="summary-icon">📤</div>
          <div class="summary-value" id="total-expense">₹0</div>
          <div class="summary-label">Total Expenses</div>
          <div class="summary-breakdown" id="expense-breakdown"></div>
        </div>
      </div>
      <div class="card"><div class="card-header"><span class="card-title">Transaction History</span></div><div class="card-body"><table class="data-table"><thead><tr><th>Transaction Date</th><th>Logged At</th><th>Type</th><th>Category</th><th>Description</th><th>Amount</th><th>By</th></tr></thead><tbody id="transaction-list"><tr><td colspan="7" class="text-muted text-center">Loading...</td></tr></tbody></table></div></div>
    </div>
  `);

  initSidebar();
  loadFinancialData();
}

async function loadFinancialData() {
  try {
    const [transactions, regs] = await Promise.all([
      getDocs(query(collection(db, 'financial_transactions'), orderBy('createdAt', 'desc'))),
      getDocs(collection(db, 'sehri_registrations'))
    ]);

    let income = 0, expense = 0;
    const incomeByCategory = {};
    const expenseByCategory = {};

    // Normalize category names for consistent grouping
    function normalizeCategory(cat) {
      if (!cat) return 'Other';
      const lower = cat.toLowerCase().trim();
      if (lower === 'other' || lower === 'others') return 'Other';
      if (lower === 'registration fee') return 'Registration Fee';
      if (lower === 'donation' || lower === 'donations') return 'Donation';
      if (lower === 'sehri') return 'Sehri';
      if (lower === 'iftar') return 'Iftar';
      if (lower === 'sent to masjid') return 'Sent to Masjid';
      return cat; // keep original for any unknown categories
    }

    transactions.docs.forEach(d => {
      const t = d.data();
      const cat = normalizeCategory(t.category);
      if (t.type === 'add') {
        income += (t.amount || 0);
        incomeByCategory[cat] = (incomeByCategory[cat] || 0) + (t.amount || 0);
      }
      if (t.type === 'deduct') {
        expense += (t.amount || 0);
        expenseByCategory[cat] = (expenseByCategory[cat] || 0) + (t.amount || 0);
      }
    });
    const pending = regs.docs.filter(d => d.data().paymentStatus === 'pending').length;

    document.getElementById('total-income').textContent = formatCurrency(income);
    document.getElementById('total-expense').textContent = formatCurrency(expense);
    document.getElementById('net-balance').textContent = formatCurrency(income - expense);
    document.getElementById('pending-verifications').textContent = formatNumber(pending);

    // Helper to render breakdown rows
    function renderBreakdown(container, items) {
      if (!container || items.length === 0) return;
      container.innerHTML = items.map(({ label, amount }) =>
        `<div class="breakdown-row"><span class="breakdown-label">${escapeHtml(label)}</span><span class="breakdown-amount">${formatCurrency(amount)}</span></div>`
      ).join('');
    }

    // Income breakdown
    const incomeOrder = ['Registration Fee', 'Donation', 'Other'];
    const incomeItems = incomeOrder
      .filter(cat => incomeByCategory[cat])
      .map(cat => ({ label: cat, amount: incomeByCategory[cat] }));
    Object.keys(incomeByCategory).filter(c => !incomeOrder.includes(c)).forEach(cat => {
      incomeItems.push({ label: cat, amount: incomeByCategory[cat] });
    });
    renderBreakdown(document.getElementById('income-breakdown'), incomeItems);

    // Expense breakdown: combine Sehri + Iftar
    const sehriIftar = (expenseByCategory['Sehri'] || 0) + (expenseByCategory['Iftar'] || 0);
    const expenseItems = [];
    if (expenseByCategory['Sent to Masjid']) expenseItems.push({ label: 'Sent to Masjid', amount: expenseByCategory['Sent to Masjid'] });
    if (sehriIftar) expenseItems.push({ label: 'Sehri + Iftar', amount: sehriIftar });
    if (expenseByCategory['Other']) expenseItems.push({ label: 'Other', amount: expenseByCategory['Other'] });
    const handledExpenseCats = ['Sent to Masjid', 'Sehri', 'Iftar', 'Other'];
    Object.keys(expenseByCategory).filter(c => !handledExpenseCats.includes(c)).forEach(cat => {
      expenseItems.push({ label: cat, amount: expenseByCategory[cat] });
    });
    renderBreakdown(document.getElementById('expense-breakdown'), expenseItems);

    // Transaction History table
    const list = document.getElementById('transaction-list');
    if (transactions.empty) { list.innerHTML = '<tr><td colspan="7" class="text-muted text-center">No transactions yet</td></tr>'; return; }
    list.innerHTML = transactions.docs.map(d => {
      const t = d.data();
      const isIncome = t.type === 'add';
      const txnDate = t.transactionDate ? formatDate(new Date(t.transactionDate)) : '—';
      const loggedAt = t.createdAt ? formatDateTime(t.createdAt.toDate()) : '—';
      return `<tr>
        <td>${txnDate}</td>
        <td style="font-size:0.8rem;color:var(--text-secondary);">${loggedAt}</td>
        <td><span class="badge badge-${isIncome ? 'success' : 'danger'}">${isIncome ? 'Income' : 'Expense'}</span></td>
        <td>${escapeHtml(t.category || '—')}</td>
        <td>${escapeHtml(t.description || '—')}</td>
        <td style="color:var(--${isIncome ? 'success' : 'error'});font-weight:600;">${isIncome ? '+' : '-'}${formatCurrency(t.amount)}</td>
        <td>${escapeHtml(t.addedBy || '—')}</td>
      </tr>`;
    }).join('');
  } catch (e) { console.error('Financial data error:', e); }
}

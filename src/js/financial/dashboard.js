// ============================================================
// FINANCIAL — Dashboard
// ============================================================

import { db } from '../firebase-config.js';
import { collection, getDocs } from 'firebase/firestore';
import { getCurrentUserData } from '../auth.js';
import { getDashboardLayout, initSidebar } from '../admin/dashboard.js';
import { formatCurrency, formatNumber, escapeHtml } from '../utils/validation.js';

export function renderFinancialDashboard(container) {
  const user = getCurrentUserData();
  container.innerHTML = getDashboardLayout('dashboard', 'financial', user, `
    <div class="dashboard-header">
      <div><h1 class="page-title">Financial Dashboard</h1></div>
    </div>
    <div class="dashboard-content">
      <div class="financial-summary" id="fin-summary">
        <div class="summary-side">
          <div class="summary-card balance"><div class="summary-icon">💵</div><div class="summary-value" id="fs-balance">₹0</div><div class="summary-label">Net Balance</div></div>
          <div class="summary-card pending"><div class="summary-icon">⏳</div><div class="summary-value" id="fs-pending">0</div><div class="summary-label">Pending Verifications</div></div>
        </div>
        <div class="summary-card income">
          <div class="summary-icon">💰</div>
          <div class="summary-value" id="fs-income">₹0</div>
          <div class="summary-label">Total Income</div>
          <div class="summary-breakdown" id="fs-income-breakdown"></div>
        </div>
        <div class="summary-card expense">
          <div class="summary-icon">📤</div>
          <div class="summary-value" id="fs-expense">₹0</div>
          <div class="summary-label">Total Expenses</div>
          <div class="summary-breakdown" id="fs-expense-breakdown"></div>
        </div>
      </div>
      <div class="quick-actions">
        <a href="#/financial/verify" class="quick-action-btn"><span class="action-icon">✅</span><span class="action-label">Verify Payments</span></a>
        <a href="#/financial/transactions" class="quick-action-btn"><span class="action-icon">💸</span><span class="action-label">Transactions</span></a>
        <a href="#/financial/reports" class="quick-action-btn"><span class="action-icon">📊</span><span class="action-label">Reports</span></a>
      </div>
    </div>
  `);

  initSidebar();
  loadStats();
}

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
  return cat;
}

function renderBreakdown(container, items) {
  if (!container || items.length === 0) return;
  container.innerHTML = items.map(({ label, amount }) =>
    `<div class="breakdown-row"><span class="breakdown-label">${escapeHtml(label)}</span><span class="breakdown-amount">${formatCurrency(amount)}</span></div>`
  ).join('');
}

async function loadStats() {
  try {
    const [regs, transactions] = await Promise.all([
      getDocs(collection(db, 'sehri_registrations')),
      getDocs(collection(db, 'financial_transactions'))
    ]);

    const pending = regs.docs.filter(d => d.data().paymentStatus === 'pending').length;
    let income = 0, expense = 0;
    const incomeByCategory = {};
    const expenseByCategory = {};

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

    // Set values
    document.getElementById('fs-pending').textContent = formatNumber(pending);
    document.getElementById('fs-income').textContent = formatCurrency(income);
    document.getElementById('fs-expense').textContent = formatCurrency(expense);
    document.getElementById('fs-balance').textContent = formatCurrency(income - expense);

    // Income breakdown
    const incomeOrder = ['Registration Fee', 'Donation', 'Other'];
    const incomeItems = incomeOrder
      .filter(cat => incomeByCategory[cat])
      .map(cat => ({ label: cat, amount: incomeByCategory[cat] }));
    Object.keys(incomeByCategory).filter(c => !incomeOrder.includes(c)).forEach(cat => {
      incomeItems.push({ label: cat, amount: incomeByCategory[cat] });
    });
    renderBreakdown(document.getElementById('fs-income-breakdown'), incomeItems);

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
    renderBreakdown(document.getElementById('fs-expense-breakdown'), expenseItems);
  } catch (e) { console.error(e); }
}

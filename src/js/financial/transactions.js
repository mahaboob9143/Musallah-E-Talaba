// ============================================================
// FINANCIAL — Transactions (Add Cash, Add Expenditure, History)
// ============================================================

import { db } from '../firebase-config.js';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { getCurrentUserData } from '../auth.js';
import { getDashboardLayout, initSidebar } from '../admin/dashboard.js';
import { toast } from '../components/notifications.js';
import { openModal, closeModal, confirmModal } from '../components/modal.js';
import { logAction, ACTIONS, ENTITIES } from '../utils/audit-logger.js';
import { formatDate, formatDateTime } from '../utils/date-utils.js';
import { formatCurrency, formatNumber, sanitize, escapeHtml } from '../utils/validation.js';

// Module-level store for all transactions (for client-side filtering)
let allTransactions = [];

export function renderTransactions(container) {
  const user = getCurrentUserData();
  container.innerHTML = getDashboardLayout('transactions', 'financial', user, `
    <div class="dashboard-header">
      <div><h1 class="page-title">Transactions</h1></div>
      <div class="header-actions">
        <button class="btn btn-success" id="add-cash-btn">💰 Add Cash</button>
        <button class="btn btn-danger" id="add-expense-btn">📤 Add Expenditure</button>
      </div>
    </div>
    <div class="dashboard-content">
      <div class="financial-summary" id="txn-summary">
        <div class="summary-side">
          <div class="summary-card balance"><div class="summary-icon">💵</div><div class="summary-value" id="txn-balance">₹0</div><div class="summary-label">Net Balance</div></div>
          <div class="summary-card pending"><div class="summary-icon">⏳</div><div class="summary-value" id="txn-pending">0</div><div class="summary-label">Pending Verifications</div></div>
        </div>
        <div class="summary-card income">
          <div class="summary-icon">💰</div>
          <div class="summary-value" id="txn-income">₹0</div>
          <div class="summary-label">Total Income</div>
          <div class="summary-breakdown" id="txn-income-breakdown"></div>
        </div>
        <div class="summary-card expense">
          <div class="summary-icon">📤</div>
          <div class="summary-value" id="txn-expense">₹0</div>
          <div class="summary-label">Total Expenses</div>
          <div class="summary-breakdown" id="txn-expense-breakdown"></div>
        </div>
      </div>
      <div class="card"><div class="card-body">
        <div class="table-toolbar">
          <div class="toolbar-left">
            <input type="text" class="search-input" id="txn-search" placeholder="🔍 Search description..." />
            <select class="filter-select" id="txn-type-filter">
              <option value="">All Types</option>
              <option value="add">Income</option>
              <option value="deduct">Expense</option>
            </select>
            <select class="filter-select" id="txn-category-filter">
              <option value="">All Categories</option>
            </select>
          </div>
          <div class="toolbar-right">
            <span class="text-muted" id="txn-count-label" style="font-size:0.85rem;"></span>
          </div>
        </div>
        <table class="data-table"><thead><tr><th>Transaction Date</th><th>Logged At</th><th>Type</th><th>Description</th><th>Category</th><th>Amount</th><th>By</th><th>Actions</th></tr></thead><tbody id="txn-list"><tr><td colspan="8" class="text-muted text-center">Loading...</td></tr></tbody></table>
      </div></div>
    </div>
  `);

  initSidebar();
  loadTransactions();
  document.getElementById('add-cash-btn')?.addEventListener('click', () => showTransactionModal('add'));
  document.getElementById('add-expense-btn')?.addEventListener('click', () => showTransactionModal('deduct'));

  // Filter event listeners
  document.getElementById('txn-search')?.addEventListener('input', applyFilters);
  document.getElementById('txn-type-filter')?.addEventListener('change', applyFilters);
  document.getElementById('txn-category-filter')?.addEventListener('change', applyFilters);
}

function applyFilters() {
  const searchTerm = (document.getElementById('txn-search')?.value || '').toLowerCase().trim();
  const typeFilter = document.getElementById('txn-type-filter')?.value || '';
  const categoryFilter = document.getElementById('txn-category-filter')?.value || '';

  let filtered = allTransactions;

  if (searchTerm) {
    filtered = filtered.filter(t =>
      (t.data.description || '').toLowerCase().includes(searchTerm) ||
      (t.data.addedBy || '').toLowerCase().includes(searchTerm)
    );
  }
  if (typeFilter) {
    filtered = filtered.filter(t => t.data.type === typeFilter);
  }
  if (categoryFilter) {
    filtered = filtered.filter(t => t.data.category === categoryFilter);
  }

  renderTransactionRows(filtered);
}

function renderTransactionRows(transactions) {
  const list = document.getElementById('txn-list');
  const countLabel = document.getElementById('txn-count-label');
  if (!list) return;

  if (countLabel) countLabel.textContent = `${transactions.length} of ${allTransactions.length} transactions`;

  if (transactions.length === 0) {
    list.innerHTML = '<tr><td colspan="8" class="text-muted text-center">No matching transactions</td></tr>';
    return;
  }

  list.innerHTML = transactions.map(item => {
    const t = item.data;
    const isAdd = t.type === 'add';
    const txnDate = t.transactionDate ? formatDate(new Date(t.transactionDate)) : '—';
    const loggedAt = t.createdAt ? formatDateTime(t.createdAt.toDate()) : '—';
    return `<tr>
      <td>${txnDate}</td>
      <td style="font-size:0.8rem;color:var(--text-secondary);">${loggedAt}</td>
      <td><span class="badge badge-${isAdd ? 'success' : 'danger'}">${isAdd ? 'Income' : 'Expense'}</span></td>
      <td>${escapeHtml(t.description || '—')}</td>
      <td>${escapeHtml(t.category || '—')}</td>
      <td style="color:var(--${isAdd ? 'success' : 'error'});font-weight:600;">${isAdd ? '+' : '-'}${formatCurrency(t.amount)}</td>
      <td>${escapeHtml(t.addedBy || '—')}</td>
      <td style="white-space:nowrap;">
        <button class="btn-icon" data-edit="${item.id}" title="Edit">✏️</button>
        <button class="btn-icon danger" data-delete="${item.id}" title="Delete">🗑️</button>
      </td>
    </tr>`;
  }).join('');

  // Attach row-level event listeners after rendering
  list.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-edit');
      const item = allTransactions.find(t => t.id === id);
      if (item) showEditModal(id, item.data);
    });
  });

  list.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-delete');
      const item = allTransactions.find(t => t.id === id);
      if (item) confirmDeleteTransaction(id, item.data);
    });
  });
}

function populateCategoryFilter() {
  const select = document.getElementById('txn-category-filter');
  if (!select) return;

  const categories = [...new Set(allTransactions.map(t => t.data.category).filter(Boolean))].sort();
  const currentValue = select.value;

  select.innerHTML = '<option value="">All Categories</option>' +
    categories.map(c => `<option value="${escapeHtml(c)}" ${c === currentValue ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
}

async function loadTransactions() {
  const list = document.getElementById('txn-list');
  if (!list) return;

  try {
    const q = query(collection(db, 'financial_transactions'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);

    if (snap.empty) {
      allTransactions = [];
      list.innerHTML = '<tr><td colspan="8" class="text-muted text-center">No transactions yet</td></tr>';
      return;
    }

    allTransactions = snap.docs.map(d => ({ id: d.id, data: d.data() }));
    populateCategoryFilter();
    updateSummaryCards();
    applyFilters();
  } catch (e) { list.innerHTML = '<tr><td colspan="8" class="text-muted">Error loading</td></tr>'; }
}

// ── SUMMARY CARDS ────────────────────────────────────────────

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

async function updateSummaryCards() {
  try {
    let income = 0, expense = 0;
    const incomeByCategory = {};
    const expenseByCategory = {};

    allTransactions.forEach(item => {
      const t = item.data;
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

    // Fetch pending verifications count
    const regs = await getDocs(collection(db, 'sehri_registrations'));
    const pending = regs.docs.filter(d => d.data().paymentStatus === 'pending').length;

    // Update values
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('txn-income', formatCurrency(income));
    setEl('txn-expense', formatCurrency(expense));
    setEl('txn-balance', formatCurrency(income - expense));
    setEl('txn-pending', formatNumber(pending));

    // Income breakdown
    const incomeOrder = ['Registration Fee', 'Donation', 'Other'];
    const incomeItems = incomeOrder
      .filter(cat => incomeByCategory[cat])
      .map(cat => ({ label: cat, amount: incomeByCategory[cat] }));
    Object.keys(incomeByCategory).filter(c => !incomeOrder.includes(c)).forEach(cat => {
      incomeItems.push({ label: cat, amount: incomeByCategory[cat] });
    });
    renderBreakdown(document.getElementById('txn-income-breakdown'), incomeItems);

    // Expense breakdown
    const sehriIftar = (expenseByCategory['Sehri'] || 0) + (expenseByCategory['Iftar'] || 0);
    const expenseItems = [];
    if (expenseByCategory['Sent to Masjid']) expenseItems.push({ label: 'Sent to Masjid', amount: expenseByCategory['Sent to Masjid'] });
    if (sehriIftar) expenseItems.push({ label: 'Sehri + Iftar', amount: sehriIftar });
    if (expenseByCategory['Other']) expenseItems.push({ label: 'Other', amount: expenseByCategory['Other'] });
    const handledExpenseCats = ['Sent to Masjid', 'Sehri', 'Iftar', 'Other'];
    Object.keys(expenseByCategory).filter(c => !handledExpenseCats.includes(c)).forEach(cat => {
      expenseItems.push({ label: cat, amount: expenseByCategory[cat] });
    });
    renderBreakdown(document.getElementById('txn-expense-breakdown'), expenseItems);
  } catch (e) { console.error('Summary update error:', e); }
}

// ── ADD TRANSACTION ──────────────────────────────────────────

function showTransactionModal(type) {
  const isAdd = type === 'add';
  const categories = isAdd
    ? ['Registration Fee', 'Donation', 'Other']
    : ['Sent to Masjid', 'Sehri', 'Iftar', 'Other'];
  const todayISO = new Date().toISOString().split('T')[0];

  openModal({
    title: isAdd ? '💰 Add Income' : '📤 Add Expenditure',
    content: `<form id="txn-form">
      <div class="form-group"><label class="form-label">Amount (₹) *</label><input name="amount" class="form-control" type="number" min="1" required /><div class="form-error" data-error="amount"></div></div>
      <div class="form-group"><label class="form-label">Date</label><input name="transactionDate" class="form-control" type="date" value="${todayISO}" /><div class="form-hint" style="font-size:0.75rem;color:var(--text-tertiary);margin-top:4px;">Defaults to today. Change if this transaction was on a different date.</div></div>
      <div class="form-group"><label class="form-label">Category *</label><select name="category" class="form-control"><option value="">Select</option>${categories.map(c => `<option>${c}</option>`).join('')}</select><div class="form-error" data-error="category"></div></div>
      <div class="form-group"><label class="form-label">Description *</label><textarea name="description" class="form-control" rows="3" required></textarea><div class="form-error" data-error="description"></div></div>
    </form>`,
    actions: [
      { label: 'Cancel', class: 'btn-secondary', onClick: closeModal },
      { label: isAdd ? 'Add Income' : 'Add Expense', class: isAdd ? 'btn-success' : 'btn-danger', onClick: (modal) => handleAddTransaction(modal, type) }
    ]
  });
}

async function handleAddTransaction(modal, type) {
  const form = modal.querySelector('#txn-form');
  const data = Object.fromEntries(new FormData(form));
  if (!data.amount || !data.category || !data.description) { toast.error('Please fill all fields'); return; }

  const user = getCurrentUserData();
  try {
    const txnDoc = {
      type,
      amount: Number(data.amount),
      category: data.category,
      description: sanitize(data.description),
      addedBy: user?.name || '',
      addedByUid: user?.id || '',
      createdAt: serverTimestamp()
    };
    if (data.transactionDate) txnDoc.transactionDate = data.transactionDate;
    await addDoc(collection(db, 'financial_transactions'), txnDoc);
    await logAction({ action: ACTIONS.CREATE, entity: ENTITIES.TRANSACTION, details: `${type === 'add' ? 'Income' : 'Expense'}: ${formatCurrency(data.amount)} — ${data.description}` });
    toast.success('Transaction added!');
    closeModal();
    loadTransactions();
  } catch (e) { toast.error('Failed: ' + e.message); }
}

// ── EDIT TRANSACTION ─────────────────────────────────────────

function showEditModal(id, txnData) {
  const isAdd = txnData.type === 'add';
  const categories = isAdd
    ? ['Registration Fee', 'Donation', 'Other']
    : ['Sent to Masjid', 'Sehri', 'Iftar', 'Other'];

  // Ensure the current category is in the list (in case of custom data)
  const allCats = [...new Set([...categories, txnData.category].filter(Boolean))];
  const existingDate = txnData.transactionDate || (txnData.createdAt ? txnData.createdAt.toDate().toISOString().split('T')[0] : '');

  openModal({
    title: '✏️ Edit Transaction',
    content: `<form id="edit-txn-form">
      <div class="form-group"><label class="form-label">Amount (₹) *</label><input name="amount" class="form-control" type="number" min="1" value="${escapeHtml(String(txnData.amount || ''))}" required /></div>
      <div class="form-group"><label class="form-label">Date</label><input name="transactionDate" class="form-control" type="date" value="${existingDate}" /></div>
      <div class="form-group"><label class="form-label">Category *</label>
        <select name="category" class="form-control">
          ${allCats.map(c => `<option value="${escapeHtml(c)}" ${c === txnData.category ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label class="form-label">Description *</label><textarea name="description" class="form-control" rows="3" required>${escapeHtml(txnData.description || '')}</textarea></div>
    </form>`,
    actions: [
      { label: 'Cancel', class: 'btn-secondary', onClick: closeModal },
      { label: 'Save Changes', class: 'btn-primary', onClick: (modal) => handleEditTransaction(modal, id, txnData) }
    ]
  });
}

async function handleEditTransaction(modal, id, originalData) {
  const form = modal.querySelector('#edit-txn-form');
  const data = Object.fromEntries(new FormData(form));
  if (!data.amount || !data.category || !data.description) { toast.error('Please fill all fields'); return; }

  try {
    const updateData = {
      amount: Number(data.amount),
      category: data.category,
      description: sanitize(data.description),
      updatedAt: serverTimestamp()
    };
    if (data.transactionDate) updateData.transactionDate = data.transactionDate;
    await updateDoc(doc(db, 'financial_transactions', id), updateData);
    await logAction({
      action: ACTIONS.UPDATE,
      entity: ENTITIES.TRANSACTION,
      entityId: id,
      details: `Edited transaction: ${formatCurrency(data.amount)} — ${data.description}`
    });
    toast.success('Transaction updated!');
    closeModal();
    loadTransactions();
  } catch (e) { toast.error('Failed to update: ' + e.message); }
}

// ── DELETE TRANSACTION ───────────────────────────────────────

function confirmDeleteTransaction(id, txnData) {
  const isAdd = txnData.type === 'add';
  confirmModal({
    title: '🗑️ Delete Transaction',
    message: `Are you sure you want to delete this ${isAdd ? 'income' : 'expense'} of <strong>${isAdd ? '+' : '-'}${formatCurrency(txnData.amount)}</strong> (${escapeHtml(txnData.description || '')})? This cannot be undone.`,
    confirmLabel: 'Delete',
    confirmClass: 'btn-danger',
    onConfirm: () => handleDeleteTransaction(id, txnData)
  });
}

async function handleDeleteTransaction(id, txnData) {
  try {
    await deleteDoc(doc(db, 'financial_transactions', id));
    await logAction({
      action: ACTIONS.DELETE,
      entity: ENTITIES.TRANSACTION,
      entityId: id,
      details: `Deleted transaction: ${txnData.type === 'add' ? 'Income' : 'Expense'} ${formatCurrency(txnData.amount)} — ${txnData.description}`
    });
    toast.success('Transaction deleted.');
    loadTransactions();
  } catch (e) { toast.error('Failed to delete: ' + e.message); }
}

// ============================================================
// FINANCIAL — Reports (Excel exports of financial data)
// ============================================================

import { db } from '../firebase-config.js';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { getCurrentUserData } from '../auth.js';
import { getDashboardLayout, initSidebar } from '../admin/dashboard.js';
import { toast } from '../components/notifications.js';
import { formatDate, getToday } from '../utils/date-utils.js';
import { formatCurrency } from '../utils/validation.js';

export function renderFinancialReports(container) {
  const user = getCurrentUserData();
  container.innerHTML = getDashboardLayout('reports', 'financial', user, `
    <div class="dashboard-header">
      <div><h1 class="page-title">Financial Reports</h1></div>
    </div>
    <div class="dashboard-content">
      <div class="quick-actions">
        <button class="quick-action-btn" id="export-txn"><span class="action-icon">💸</span><span class="action-label">Export Transactions (Excel)</span></button>
        <button class="quick-action-btn" id="export-summary"><span class="action-icon">📊</span><span class="action-label">Export Summary (PDF)</span></button>
      </div>
    </div>
  `);

  initSidebar();
  document.getElementById('export-txn')?.addEventListener('click', exportTransactionsExcel);
  document.getElementById('export-summary')?.addEventListener('click', exportSummaryPDF);
}

/**
 * Helper: get XLSX library (handles both default and namespace export)
 */
async function getXLSX() {
  const mod = await import('xlsx');
  return mod.default || mod;
}

/**
 * Helper: get jsPDF with autoTable plugin
 */
async function getJsPDF() {
  const jsPDFModule = await import('jspdf');
  const jsPDF = jsPDFModule.default || jsPDFModule.jsPDF;
  await import('jspdf-autotable');
  return jsPDF;
}

async function exportTransactionsExcel() {
  toast.info('Generating...');
  try {
    const XLSX = await getXLSX();
    const snap = await getDocs(query(collection(db, 'financial_transactions'), orderBy('createdAt', 'desc')));
    const data = snap.docs.map(d => {
      const t = d.data();
      return {
        Date: t.createdAt ? formatDate(t.createdAt.toDate()) : '',
        Type: t.type === 'add' ? 'Income' : 'Expense',
        Category: t.category || '',
        Description: t.description || '',
        Amount: t.amount || 0,
        'Added By': t.addedBy || ''
      };
    });

    if (data.length === 0) { toast.warning('No data to export'); return; }

    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = Object.keys(data[0]).map(key => ({
      wch: Math.max(key.length + 2, ...data.map(row => String(row[key] || '').length + 2))
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    XLSX.writeFile(wb, `financial_report_${getToday()}.xlsx`);
    toast.success('Downloaded!');
  } catch (e) { console.error('Export error:', e); toast.error('Export failed: ' + e.message); }
}

async function exportSummaryPDF() {
  toast.info('Generating PDF...');
  try {
    const jsPDF = await getJsPDF();
    const snap = await getDocs(query(collection(db, 'financial_transactions'), orderBy('createdAt', 'desc')));

    if (snap.empty) { toast.warning('No data to export'); return; }

    let income = 0, expense = 0;
    const rows = snap.docs.map(d => {
      const t = d.data();
      if (t.type === 'add') income += (t.amount || 0);
      if (t.type === 'deduct') expense += (t.amount || 0);
      return [
        t.createdAt ? formatDate(t.createdAt.toDate()) : '',
        t.type === 'add' ? 'Income' : 'Expense',
        t.category || '',
        t.description || '',
        formatCurrency(t.amount || 0)
      ];
    });

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Financial Summary — Musallah-E-Talaba', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${formatDate(new Date())}`, 14, 28);
    doc.text(`Total Income: ${formatCurrency(income)}  |  Total Expense: ${formatCurrency(expense)}  |  Balance: ${formatCurrency(income - expense)}`, 14, 35);
    doc.autoTable({
      startY: 42,
      head: [['Date', 'Type', 'Category', 'Description', 'Amount']],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [244, 196, 48], textColor: [0, 0, 0], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    });
    doc.save(`financial_summary_${getToday()}.pdf`);
    toast.success('PDF downloaded!');
  } catch (e) { console.error('Export error:', e); toast.error('Export failed: ' + e.message); }
}

// ============================================================
// ADMIN — Reports (PDF + Excel Export)
// ============================================================

import { db } from '../firebase-config.js';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { getCurrentUserData } from '../auth.js';
import { getDashboardLayout, initSidebar } from './dashboard.js';
import { toast } from '../components/notifications.js';
import { formatCurrency, formatNumber } from '../utils/validation.js';
import { formatDate, getToday } from '../utils/date-utils.js';

export function renderReports(container) {
    const user = getCurrentUserData();
    container.innerHTML = getDashboardLayout('reports', 'admin', user, `
    <div class="dashboard-header">
      <div><h1 class="page-title">Reports</h1><div class="page-breadcrumb"><span>Admin</span><span class="separator">/</span><span class="current">Reports</span></div></div>
    </div>
    <div class="dashboard-content">
      <div class="quick-actions" style="margin-bottom:var(--space-8);">
        <button class="quick-action-btn" id="export-regs-excel"><span class="action-icon">📋</span><span class="action-label">Export Registrations (Excel)</span></button>
        <button class="quick-action-btn" id="export-regs-pdf"><span class="action-icon">📄</span><span class="action-label">Registrations Report (PDF)</span></button>
        <button class="quick-action-btn" id="export-financial-excel"><span class="action-icon">💰</span><span class="action-label">Financial Report (Excel)</span></button>
        <button class="quick-action-btn" id="export-feedback-excel"><span class="action-icon">💬</span><span class="action-label">Feedback Report (Excel)</span></button>
      </div>
      <div class="card"><div class="card-header"><span class="card-title">Report Summary</span></div><div class="card-body" id="report-summary"><p class="text-muted">Generating summary...</p></div></div>
    </div>
  `);

    initSidebar();
    loadReportSummary();

    document.getElementById('export-regs-excel')?.addEventListener('click', () => exportRegistrationsExcel());
    document.getElementById('export-regs-pdf')?.addEventListener('click', () => exportRegistrationsPDF());
    document.getElementById('export-financial-excel')?.addEventListener('click', () => exportFinancialExcel());
    document.getElementById('export-feedback-excel')?.addEventListener('click', () => exportFeedbackExcel());
}

async function loadReportSummary() {
    const el = document.getElementById('report-summary');
    try {
        const [regs, feedback, donations, transactions] = await Promise.all([
            getDocs(collection(db, 'sehri_registrations')),
            getDocs(collection(db, 'feedback_submissions')),
            getDocs(collection(db, 'donations')),
            getDocs(collection(db, 'financial_transactions'))
        ]);

        let income = 0, expense = 0;
        transactions.docs.forEach(d => {
            const t = d.data();
            if (t.type === 'add') income += (t.amount || 0);
            if (t.type === 'deduct') expense += (t.amount || 0);
        });

        const verified = regs.docs.filter(d => d.data().paymentStatus === 'verified').length;
        const pending = regs.docs.filter(d => d.data().paymentStatus === 'pending').length;
        const avgRating = feedback.docs.length ? (feedback.docs.reduce((s, d) => s + (d.data().rating || 0), 0) / feedback.docs.length).toFixed(1) : 'N/A';

        el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;">
        <div class="stat-card"><div class="stat-icon" style="background:var(--gold-glow);color:var(--gold);">📝</div><div class="stat-value">${formatNumber(regs.size)}</div><div class="stat-label">Total Registrations</div></div>
        <div class="stat-card"><div class="stat-icon" style="background:var(--success-bg);color:var(--success);">✅</div><div class="stat-value">${formatNumber(verified)}</div><div class="stat-label">Verified</div></div>
        <div class="stat-card"><div class="stat-icon" style="background:var(--warning-bg);color:var(--warning);">⏳</div><div class="stat-value">${formatNumber(pending)}</div><div class="stat-label">Pending</div></div>
        <div class="stat-card"><div class="stat-icon" style="background:var(--gold-glow);color:var(--gold);">💰</div><div class="stat-value">${formatCurrency(income)}</div><div class="stat-label">Total Income</div></div>
        <div class="stat-card"><div class="stat-icon" style="background:var(--error-bg);color:var(--error);">📤</div><div class="stat-value">${formatCurrency(expense)}</div><div class="stat-label">Total Expenses</div></div>
        <div class="stat-card"><div class="stat-icon" style="background:var(--gold-glow);color:var(--gold);">⭐</div><div class="stat-value">${avgRating}</div><div class="stat-label">Avg Rating</div></div>
      </div>
    `;
    } catch (e) { el.innerHTML = '<p class="text-muted">Error loading summary</p>'; }
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

async function exportRegistrationsExcel() {
    toast.info('Generating Excel...');
    try {
        const XLSX = await getXLSX();
        const snap = await getDocs(query(collection(db, 'sehri_registrations'), orderBy('submittedAt', 'desc')));
        const data = snap.docs.map(d => {
            const r = d.data();
            return {
                Name: r.name || '',
                Mobile: r.mobile || '',
                'Roll No': r.rollNumber || '',
                Branch: r.branch || '',
                Year: r.year || '',
                Course: r.course || '',
                Zone: r.zone || '',
                Address: r.address || '',
                'Payment Status': r.paymentStatus || '',
                Submitted: r.submittedAt ? formatDate(r.submittedAt.toDate()) : ''
            };
        });

        if (data.length === 0) { toast.warning('No data to export'); return; }

        const ws = XLSX.utils.json_to_sheet(data);
        // Auto-size columns
        ws['!cols'] = Object.keys(data[0]).map(key => ({
            wch: Math.max(key.length + 2, ...data.map(row => String(row[key] || '').length + 2))
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Registrations');
        XLSX.writeFile(wb, `registrations_${getToday()}.xlsx`);
        toast.success('Excel downloaded!');
    } catch (e) { console.error('Export error:', e); toast.error('Export failed: ' + e.message); }
}

async function exportRegistrationsPDF() {
    toast.info('Generating PDF...');
    try {
        const jsPDF = await getJsPDF();
        const snap = await getDocs(query(collection(db, 'sehri_registrations'), orderBy('submittedAt', 'desc')));

        if (snap.empty) { toast.warning('No data to export'); return; }

        const rows = snap.docs.map(d => {
            const r = d.data();
            return [r.name || '', r.mobile || '', r.rollNumber || '', `${r.branch || ''}/${r.year || ''}`, r.zone || '', r.paymentStatus || ''];
        });

        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text('Musallah-E-Talaba — Registration Report', 14, 22);
        doc.setFontSize(10);
        doc.text(`Generated: ${formatDate(new Date())}  |  Total: ${rows.length} registrations`, 14, 30);
        doc.autoTable({
            startY: 38,
            head: [['Name', 'Mobile', 'Roll No', 'Branch/Year', 'Zone', 'Status']],
            body: rows,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 3 },
            headStyles: { fillColor: [244, 196, 48], textColor: [0, 0, 0], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [245, 245, 245] }
        });
        doc.save(`registrations_${getToday()}.pdf`);
        toast.success('PDF downloaded!');
    } catch (e) { console.error('Export error:', e); toast.error('Export failed: ' + e.message); }
}

async function exportFinancialExcel() {
    toast.info('Generating Excel...');
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
        XLSX.writeFile(wb, `financial_${getToday()}.xlsx`);
        toast.success('Excel downloaded!');
    } catch (e) { console.error('Export error:', e); toast.error('Export failed: ' + e.message); }
}

async function exportFeedbackExcel() {
    toast.info('Generating Excel...');
    try {
        const XLSX = await getXLSX();
        const snap = await getDocs(query(collection(db, 'feedback_submissions'), orderBy('submittedAt', 'desc')));
        const data = snap.docs.map(d => {
            const f = d.data();
            return {
                Name: f.name || '',
                Rating: f.rating || 0,
                Experience: f.helpMessage || '',
                Suggestions: f.improvementSuggestions || '',
                Date: f.submittedAt ? formatDate(f.submittedAt.toDate()) : ''
            };
        });

        if (data.length === 0) { toast.warning('No data to export'); return; }

        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = Object.keys(data[0]).map(key => ({
            wch: Math.max(key.length + 2, ...data.map(row => String(row[key] || '').length + 2))
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Feedback');
        XLSX.writeFile(wb, `feedback_${getToday()}.xlsx`);
        toast.success('Excel downloaded!');
    } catch (e) { console.error('Export error:', e); toast.error('Export failed: ' + e.message); }
}

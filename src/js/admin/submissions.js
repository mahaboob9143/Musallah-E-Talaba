// ============================================================
// ADMIN — Submissions View (Sehri, Feedback, Donations)
// ============================================================

import { db } from '../firebase-config.js';
import { collection, getDocs, query, orderBy, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { getCurrentUserData } from '../auth.js';
import { getDashboardLayout, initSidebar } from './dashboard.js';
import { toast } from '../components/notifications.js';
import { openModal, closeModal, confirmModal } from '../components/modal.js';
import { formatDate, formatDateTime } from '../utils/date-utils.js';
import { formatCurrency, escapeHtml } from '../utils/validation.js';

let currentTab = 'sehri';

export function renderSubmissions(container) {
    const user = getCurrentUserData();
    container.innerHTML = getDashboardLayout('submissions', 'admin', user, `
    <div class="dashboard-header">
      <div><h1 class="page-title">Submissions</h1><div class="page-breadcrumb"><span>Admin</span><span class="separator">/</span><span class="current">Submissions</span></div></div>
    </div>
    <div class="dashboard-content">
      <div class="tabs"><button class="tab active" data-tab="sehri">📝 Registrations</button><button class="tab" data-tab="feedback">💬 Feedback</button><button class="tab" data-tab="donations">💰 Donations</button></div>
      <div class="table-toolbar"><div class="search-box"><input class="search-input" id="search-input" placeholder="Search submissions..." /></div></div>
      <div id="submissions-content"></div>
    </div>
  `);

    initSidebar();
    container.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            loadContent();
        });
    });

    document.getElementById('search-input')?.addEventListener('input', (e) => filterTable(e.target.value));
    loadContent();
}

async function loadContent() {
    const el = document.getElementById('submissions-content');
    if (!el) return;
    el.innerHTML = '<p class="text-muted" style="padding:1rem;">Loading...</p>';

    try {
        switch (currentTab) {
            case 'sehri': await loadSehriRegistrations(el); break;
            case 'feedback': await loadFeedback(el); break;
            case 'donations': await loadDonations(el); break;
        }
    } catch (e) { el.innerHTML = '<p class="text-muted">Error loading data</p>'; }
}

async function loadSehriRegistrations(el) {
    const q = query(collection(db, 'sehri_registrations'), orderBy('submittedAt', 'desc'));
    const snap = await getDocs(q);
    if (snap.empty) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><p>No registrations yet</p></div>'; return; }

    el.innerHTML = `<div class="card"><div class="card-body"><table class="data-table" id="data-table"><thead><tr><th>Name</th><th>Mobile</th><th>Roll No</th><th>Branch/Year</th><th>Zone</th><th>Payment</th><th>Date</th><th>Actions</th></tr></thead><tbody>${snap.docs.map(d => {
        const r = d.data();
        const statusClass = r.paymentStatus === 'verified' ? 'success' : r.paymentStatus === 'rejected' ? 'danger' : 'warning';
        return `<tr data-search="${escapeHtml((r.name + r.mobile + r.rollNumber + r.zone).toLowerCase())}">
      <td><strong>${escapeHtml(r.name)}</strong></td><td>${escapeHtml(r.mobile || '')}</td><td>${escapeHtml(r.rollNumber || '')}</td><td>${escapeHtml(r.branch || '')} / ${escapeHtml(r.year || '')}</td><td>${escapeHtml(r.zone || '—')}</td>
      <td><span class="badge badge-${statusClass}">${escapeHtml(r.paymentStatus)}</span></td>
      <td>${r.submittedAt ? formatDate(r.submittedAt.toDate()) : '—'}</td>
      <td><button class="btn btn-sm btn-secondary view-reg" data-id="${d.id}">View</button></td>
    </tr>`;
    }).join('')}</tbody></table></div></div>`;

    el.querySelectorAll('.view-reg').forEach(btn => btn.addEventListener('click', () => viewRegistration(btn.dataset.id)));
}

async function loadFeedback(el) {
    const q = query(collection(db, 'feedback_submissions'), orderBy('submittedAt', 'desc'));
    const snap = await getDocs(q);
    if (snap.empty) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">💬</div><p>No feedback yet</p></div>'; return; }

    el.innerHTML = `<div class="card"><div class="card-body"><table class="data-table" id="data-table"><thead><tr><th>Name</th><th>Rating</th><th>Experience</th><th>Suggestions</th><th>Date</th></tr></thead><tbody>${snap.docs.map(d => {
        const f = d.data();
        return `<tr data-search="${(f.name + f.helpMessage).toLowerCase()}"><td><strong>${escapeHtml(f.name)}</strong></td><td>${'⭐'.repeat(f.rating || 0)}</td><td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(f.helpMessage || '')}</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(f.improvementSuggestions || '—')}</td><td>${f.submittedAt ? formatDate(f.submittedAt.toDate()) : '—'}</td></tr>`;
    }).join('')}</tbody></table></div></div>`;
}

async function loadDonations(el) {
    const q = query(collection(db, 'donations'), orderBy('submittedAt', 'desc'));
    const snap = await getDocs(q);
    if (snap.empty) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">💰</div><p>No donation inquiries yet</p></div>'; return; }

    el.innerHTML = `<div class="card"><div class="card-body"><table class="data-table" id="data-table"><thead><tr><th>Name</th><th>Email</th><th>Subject</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>${snap.docs.map(d => {
        const don = d.data();
        return `<tr data-search="${escapeHtml((don.name + don.email + don.subject).toLowerCase())}"><td><strong>${escapeHtml(don.name)}</strong></td><td>${escapeHtml(don.email)}</td><td>${escapeHtml(don.subject)}</td><td>${formatCurrency(don.amount)}</td><td><span class="badge badge-warning">${escapeHtml(don.status || 'pending')}</span></td><td>${don.submittedAt ? formatDate(don.submittedAt.toDate()) : '—'}</td></tr>`;
    }).join('')}</tbody></table></div></div>`;
}

async function viewRegistration(id) {
    const snap = await getDoc(doc(db, 'sehri_registrations', id));
    if (!snap.exists()) { toast.error('Registration not found'); return; }
    const r = snap.data();

    openModal({
        title: 'Registration Details',
        size: 'lg',
        content: `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
        <div class="form-group"><label class="form-label">Name</label><div>${escapeHtml(r.name)}</div></div>
        <div class="form-group"><label class="form-label">Mobile</label><div>${escapeHtml(r.mobile)}</div></div>
        <div class="form-group"><label class="form-label">Roll Number</label><div>${escapeHtml(r.rollNumber)}</div></div>
        <div class="form-group"><label class="form-label">Branch / Year</label><div>${escapeHtml(r.branch)} / ${escapeHtml(r.year)}</div></div>
        <div class="form-group"><label class="form-label">Course</label><div>${escapeHtml(r.course || '—')}</div></div>
        <div class="form-group"><label class="form-label">Zone</label><div>${escapeHtml(r.zone || '—')}</div></div>
        <div class="form-group" style="grid-column:1/-1;"><label class="form-label">Address</label><div>${escapeHtml(r.address || '—')}</div></div>
        <div class="form-group"><label class="form-label">Payment Status</label><div><span class="badge badge-${r.paymentStatus === 'verified' ? 'success' : 'warning'}">${escapeHtml(r.paymentStatus)}</span></div></div>
        <div class="form-group"><label class="form-label">Submitted</label><div>${r.submittedAt ? formatDateTime(r.submittedAt.toDate()) : '—'}</div></div>
        ${r.receiptUrl ? `<div class="form-group" style="grid-column:1/-1;"><label class="form-label">Receipt</label><div><a href="${r.receiptUrl}" target="_blank" class="btn btn-sm btn-secondary">📎 View Receipt</a></div></div>` : ''}
      </div>
    `,
        actions: [{ label: 'Close', class: 'btn-secondary', onClick: closeModal }]
    });
}

function filterTable(query) {
    const rows = document.querySelectorAll('#data-table tbody tr');
    const q = query.toLowerCase();
    rows.forEach(row => {
        const searchData = row.dataset.search || '';
        row.style.display = searchData.includes(q) ? '' : 'none';
    });
}

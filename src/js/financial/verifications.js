// ============================================================
// FINANCIAL — Payment Verification Flow
// ============================================================

import { db } from '../firebase-config.js';
import { collection, getDocs, getDoc, query, where, orderBy, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getCurrentUserData } from '../auth.js';
import { getDashboardLayout, initSidebar } from '../admin/dashboard.js';
import { toast } from '../components/notifications.js';
import { openModal, closeModal } from '../components/modal.js';
import { logAction, ACTIONS, ENTITIES } from '../utils/audit-logger.js';
import { formatDate, formatDateTime } from '../utils/date-utils.js';
import { escapeHtml, formatCurrency } from '../utils/validation.js';

export function renderVerifications(container) {
    const user = getCurrentUserData();
    container.innerHTML = getDashboardLayout('verify', 'financial', user, `
    <div class="dashboard-header">
      <div><h1 class="page-title">Payment Verifications</h1></div>
    </div>
    <div class="dashboard-content">
      <div class="tabs"><button class="tab active" data-status="pending">⏳ Pending</button><button class="tab" data-status="verified">✅ Verified</button><button class="tab" data-status="rejected">❌ Rejected</button></div>
      <div id="verification-list"><p class="text-muted" style="padding:1rem;">Loading...</p></div>
    </div>
  `);

    initSidebar();
    let currentStatus = 'pending';

    container.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentStatus = tab.dataset.status;
            loadVerifications(currentStatus);
        });
    });

    loadVerifications(currentStatus);
}

async function loadVerifications(status) {
    const el = document.getElementById('verification-list');
    if (!el) return;

    try {
        const q = query(collection(db, 'sehri_registrations'), where('paymentStatus', '==', status), orderBy('submittedAt', 'desc'));
        const snap = await getDocs(q);

        if (snap.empty) {
            el.innerHTML = `<div class="empty-state"><div class="empty-icon">${status === 'pending' ? '✅' : '📝'}</div><p>No ${status} registrations</p></div>`;
            return;
        }

        el.innerHTML = snap.docs.map(d => {
            const r = d.data();
            const actions = status === 'pending' ? `
        <button class="btn btn-sm btn-success approve-btn" data-id="${d.id}">✅ Approve</button>
        <button class="btn btn-sm btn-danger reject-btn" data-id="${d.id}">❌ Reject</button>
        <button class="btn btn-sm btn-secondary view-btn" data-id="${d.id}">👁 View</button>
      ` : `<button class="btn btn-sm btn-secondary view-btn" data-id="${d.id}">👁 View</button>`;

            return `
        <div class="verification-card card" style="margin-bottom:1rem;">
          <div class="card-body" style="display:grid;grid-template-columns:1fr auto;gap:1rem;align-items:center;">
            <div>
              <h4 style="margin:0;font-weight:600;">${escapeHtml(r.name)}</h4>
              <p class="text-muted" style="margin:4px 0 0;font-size:0.85rem;">${escapeHtml(r.mobile)} · ${escapeHtml(r.rollNumber)} · ${escapeHtml(r.branch)}/${escapeHtml(r.year)} · ${escapeHtml(r.zone || '—')}</p>
              <p class="text-muted" style="margin:4px 0 0;font-size:0.8rem;">${r.submittedAt ? formatDateTime(r.submittedAt.toDate()) : ''}</p>
              ${r.receiptUrl ? `<a href="${r.receiptUrl}" target="_blank" class="btn btn-sm btn-outline" style="margin-top:8px;">📎 Receipt</a>` : ''}
            </div>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">${actions}</div>
          </div>
        </div>
      `;
        }).join('');

        el.querySelectorAll('.approve-btn').forEach(btn => btn.addEventListener('click', () => handleVerify(btn.dataset.id, 'verified')));
        el.querySelectorAll('.reject-btn').forEach(btn => btn.addEventListener('click', () => showRejectModal(btn.dataset.id)));
        el.querySelectorAll('.view-btn').forEach(btn => btn.addEventListener('click', () => viewDetails(btn.dataset.id)));
    } catch (e) { el.innerHTML = '<p class="text-muted">Error loading data</p>'; }
}

async function handleVerify(id, status, reason = '') {
    try {
        const user = getCurrentUserData();
        await updateDoc(doc(db, 'sehri_registrations', id), {
            paymentStatus: status,
            verifiedBy: user?.name || '',
            verifiedAt: serverTimestamp(),
            rejectionReason: reason || null
        });
        await logAction({ action: status === 'verified' ? ACTIONS.APPROVE : ACTIONS.REJECT, entity: ENTITIES.REGISTRATION, entityId: id, details: `Payment ${status}${reason ? ': ' + reason : ''}` });
        toast.success(`Registration ${status}!`);
        loadVerifications('pending');
    } catch (e) { toast.error('Failed to update'); }
}

function showRejectModal(id) {
    openModal({
        title: 'Reject Payment',
        content: `<div class="form-group"><label class="form-label">Reason for rejection</label><textarea id="reject-reason" class="form-control" rows="3" placeholder="Enter reason..."></textarea></div>`,
        actions: [
            { label: 'Cancel', class: 'btn-secondary', onClick: closeModal },
            {
                label: 'Reject', class: 'btn-danger', onClick: () => {
                    const reason = document.getElementById('reject-reason')?.value || '';
                    closeModal();
                    handleVerify(id, 'rejected', reason);
                }
            }
        ]
    });
}

async function viewDetails(id) {
    try {
        const snap = await getDoc(doc(db, 'sehri_registrations', id));
        if (!snap.exists()) return;
        const r = snap.data();
        openModal({
            title: 'Registration Details',
            size: 'lg',
            content: `<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;"><div><strong>Name:</strong> ${escapeHtml(r.name)}</div><div><strong>Mobile:</strong> ${escapeHtml(r.mobile)}</div><div><strong>Roll No:</strong> ${escapeHtml(r.rollNumber)}</div><div><strong>Branch/Year:</strong> ${escapeHtml(r.branch)}/${escapeHtml(r.year)}</div><div><strong>Course:</strong> ${escapeHtml(r.course || '—')}</div><div><strong>Zone:</strong> ${escapeHtml(r.zone || '—')}</div><div style="grid-column:1/-1;"><strong>Address:</strong> ${escapeHtml(r.address || '—')}</div><div><strong>Status:</strong> <span class="badge badge-${r.paymentStatus === 'verified' ? 'success' : r.paymentStatus === 'rejected' ? 'danger' : 'warning'}">${escapeHtml(r.paymentStatus)}</span></div>${r.verifiedBy ? `<div><strong>Verified by:</strong> ${escapeHtml(r.verifiedBy)}</div>` : ''}${r.rejectionReason ? `<div style="grid-column:1/-1;"><strong>Rejection Reason:</strong> ${escapeHtml(r.rejectionReason)}</div>` : ''}${r.receiptUrl ? `<div style="grid-column:1/-1;"><a href="${r.receiptUrl}" target="_blank" class="btn btn-secondary">📎 View Receipt</a></div>` : ''}</div>`,
            actions: [{ label: 'Close', class: 'btn-secondary', onClick: closeModal }]
        });
    } catch (e) { toast.error('Error loading details'); }
}

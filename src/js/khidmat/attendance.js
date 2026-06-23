// ============================================================
// KHIDMAT — Daily Attendance Entry
// ============================================================

import { db } from '../firebase-config.js';
import { collection, doc, getDoc, setDoc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { getCurrentUserData } from '../auth.js';
import { getDashboardLayout, initSidebar } from '../admin/dashboard.js';
import { toast } from '../components/notifications.js';
import { logAction, ACTIONS, ENTITIES } from '../utils/audit-logger.js';
import { getToday, formatDate } from '../utils/date-utils.js';
import { escapeHtml } from '../utils/validation.js';

export function renderAttendance(container) {
    const user = getCurrentUserData();
    const today = getToday(); // YYYY-MM-DD

    container.innerHTML = getDashboardLayout('attendance', 'khidmat', user, `
    <div class="dashboard-header">
      <div><h1 class="page-title">Daily Attendance</h1></div>
    </div>
    <div class="dashboard-content">
      <div class="attendance-form">
        <h3 style="margin-bottom:var(--space-4);">📅 Attendance Entry</h3>
        <div class="form-group" style="margin-bottom:var(--space-5);">
          <label class="form-label">Date</label>
          <input type="date" class="form-control" id="att-date" value="${today}" style="max-width:250px;" />
        </div>
        <div class="attendance-inputs">
          <div class="attendance-input-card"><div class="att-label">🌅 Sehri</div><input type="number" class="att-input" id="att-sehri" value="0" min="0" /></div>
          <div class="attendance-input-card"><div class="att-label">🌇 Iftar</div><input type="number" class="att-input" id="att-iftar" value="0" min="0" /></div>
          <div class="attendance-input-card"><div class="att-label">🌙 Taraweeh</div><input type="number" class="att-input" id="att-taraweeh" value="0" min="0" /></div>
          <div class="attendance-input-card" style="border-color:var(--gold);"><div class="att-label">TOTAL</div><div class="att-input" id="att-total" style="border:none;cursor:default;">0</div></div>
        </div>
        <div class="form-group" style="margin-top:var(--space-4);"><label class="form-label">Notes</label><textarea id="att-notes" class="form-control" rows="2" placeholder="Optional notes..."></textarea></div>
        <button class="btn btn-primary btn-lg" id="save-attendance" style="margin-top:var(--space-4);">Save Attendance</button>
      </div>
      <div class="card" style="margin-top:var(--space-6);"><div class="card-header"><span class="card-title">Attendance History</span></div><div class="card-body"><table class="data-table"><thead><tr><th>Date</th><th>Sehri</th><th>Iftar</th><th>Taraweeh</th><th>Total</th><th>By</th></tr></thead><tbody id="att-history"><tr><td colspan="6" class="text-muted text-center">Loading...</td></tr></tbody></table></div></div>
    </div>
  `);

    initSidebar();
    loadDateData(today);
    loadHistory();

    // Auto-calculate total when any meal input changes
    ['att-sehri', 'att-iftar', 'att-taraweeh'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', updateTotal);
    });

    // When date changes, load existing data for that date
    document.getElementById('att-date')?.addEventListener('change', (e) => {
        const selectedDate = e.target.value;
        if (selectedDate) loadDateData(selectedDate);
    });

    document.getElementById('save-attendance')?.addEventListener('click', () => {
        const selectedDate = document.getElementById('att-date')?.value || today;
        saveAttendance(selectedDate);
    });
}

function updateTotal() {
    const sehri = parseInt(document.getElementById('att-sehri')?.value || 0);
    const iftar = parseInt(document.getElementById('att-iftar')?.value || 0);
    const taraweeh = parseInt(document.getElementById('att-taraweeh')?.value || 0);
    const total = sehri + iftar + taraweeh;
    const el = document.getElementById('att-total');
    if (el) el.textContent = total;
}

async function loadDateData(dateStr) {
    try {
        const snap = await getDoc(doc(db, 'daily_attendance', dateStr));
        if (snap.exists()) {
            const d = snap.data();
            const sehriEl = document.getElementById('att-sehri');
            const iftarEl = document.getElementById('att-iftar');
            const taraweehEl = document.getElementById('att-taraweeh');
            const notesEl = document.getElementById('att-notes');
            if (sehriEl) sehriEl.value = d.sehri || 0;
            if (iftarEl) iftarEl.value = d.iftar || 0;
            if (taraweehEl) taraweehEl.value = d.taraweeh || 0;
            if (notesEl) notesEl.value = d.notes || '';
            updateTotal();
        } else {
            // Clear inputs for a date with no data
            ['att-sehri', 'att-iftar', 'att-taraweeh'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = 0;
            });
            const notesEl = document.getElementById('att-notes');
            if (notesEl) notesEl.value = '';
            updateTotal();
        }
    } catch (e) { /* no data yet */ }
}

async function saveAttendance(dateStr) {
    const sehri = parseInt(document.getElementById('att-sehri')?.value || 0);
    const iftar = parseInt(document.getElementById('att-iftar')?.value || 0);
    const taraweeh = parseInt(document.getElementById('att-taraweeh')?.value || 0);
    const totalMeals = sehri; // Total Meals Served = Sehri count only

    const user = getCurrentUserData();
    try {
        await setDoc(doc(db, 'daily_attendance', dateStr), {
            sehri, iftar, taraweeh, totalMeals, date: dateStr,
            notes: document.getElementById('att-notes')?.value || '',
            recordedBy: user?.name || '',
            updatedAt: serverTimestamp()
        }, { merge: true });
        await logAction({ action: ACTIONS.UPDATE, entity: ENTITIES.ATTENDANCE, entityId: dateStr, details: `Attendance: Sehri ${sehri}, Iftar ${iftar}, Taraweeh ${taraweeh} (Total: ${totalMeals})` });
        toast.success(`Saved! Sehri: ${sehri}, Iftar: ${iftar}, Taraweeh: ${taraweeh} — Total: ${totalMeals}`);
        loadHistory();
    } catch (e) { toast.error('Save failed'); }
}

async function loadHistory() {
    const list = document.getElementById('att-history');
    if (!list) return;
    try {
        const q = query(collection(db, 'daily_attendance'), orderBy('date', 'desc'));
        const snap = await getDocs(q);
        if (snap.empty) { list.innerHTML = '<tr><td colspan="6" class="text-muted text-center">No records</td></tr>'; return; }
        list.innerHTML = snap.docs.map(d => {
            const a = d.data();
            return `<tr><td>${escapeHtml(a.date)}</td><td>${a.sehri || 0}</td><td>${a.iftar || 0}</td><td>${a.taraweeh || 0}</td><td><strong>${a.totalMeals || 0}</strong></td><td>${escapeHtml(a.recordedBy || '—')}</td></tr>`;
        }).join('');
    } catch (e) { list.innerHTML = '<tr><td colspan="6" class="text-muted">Error loading</td></tr>'; }
}

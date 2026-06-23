// ============================================================
// KHIDMAT — Dashboard
// ============================================================

import { db } from '../firebase-config.js';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { getCurrentUserData } from '../auth.js';
import { getDashboardLayout, initSidebar } from '../admin/dashboard.js';
import { formatNumber, escapeHtml } from '../utils/validation.js';
import { formatDate, getToday } from '../utils/date-utils.js';

export function renderKhidmatDashboard(container) {
  const user = getCurrentUserData();
  container.innerHTML = getDashboardLayout('dashboard', 'khidmat', user, `
    <div class="dashboard-header">
      <div><h1 class="page-title">Khidmat Dashboard</h1></div>
    </div>
    <div class="dashboard-content">
      <div class="dashboard-stats">
        <div class="stat-card" id="ks-today"><div class="stat-icon" style="background:var(--gold-glow);color:var(--gold);">🍽️</div><div class="stat-value">—</div><div class="stat-label">Today's Attendance</div></div>
        <div class="stat-card" id="ks-total"><div class="stat-icon" style="background:var(--success-bg);color:var(--success);">📊</div><div class="stat-value">—</div><div class="stat-label">Total Meals Served</div></div>
        <div class="stat-card" id="ks-avg"><div class="stat-icon" style="background:var(--gold-glow);color:var(--gold);">📈</div><div class="stat-value">—</div><div class="stat-label">Avg Daily Count</div></div>
        <div class="stat-card" id="ks-days"><div class="stat-icon" style="background:var(--success-bg);color:var(--success);">📅</div><div class="stat-value">—</div><div class="stat-label">Days Recorded</div></div>
      </div>
      <div class="quick-actions">
        <a href="#/khidmat/attendance" class="quick-action-btn"><span class="action-icon">📅</span><span class="action-label">Record Attendance</span></a>
        <a href="#/khidmat/checklist" class="quick-action-btn"><span class="action-icon">📋</span><span class="action-label">Today's Checklist</span></a>
      </div>
      <div class="card" style="margin-top:var(--space-6);"><div class="card-header"><span class="card-title">Recent Attendance</span></div><div class="card-body"><table class="data-table"><thead><tr><th>Date</th><th>Meals</th><th>Recorded By</th></tr></thead><tbody id="recent-att"><tr><td colspan="3" class="text-muted text-center">Loading...</td></tr></tbody></table></div></div>
    </div>
  `);

  initSidebar(); loadStats();
}

async function loadStats() {
  try {
    const snap = await getDocs(collection(db, 'daily_attendance'));
    const today = getToday();
    let totalMeals = 0;
    let todayCount = 0;
    snap.docs.forEach(d => {
      const a = d.data();
      totalMeals += (a.totalMeals || 0);
      if (a.date === today) todayCount = a.totalMeals || 0;
    });
    const avg = snap.size ? Math.round(totalMeals / snap.size) : 0;

    setStat('ks-today', formatNumber(todayCount));
    setStat('ks-total', formatNumber(totalMeals));
    setStat('ks-avg', formatNumber(avg));
    setStat('ks-days', formatNumber(snap.size));

    // Recent attendance
    const recent = query(collection(db, 'daily_attendance'), orderBy('date', 'desc'), limit(10));
    const recentSnap = await getDocs(recent);
    const list = document.getElementById('recent-att');
    if (recentSnap.empty) { list.innerHTML = '<tr><td colspan="3" class="text-muted text-center">No records</td></tr>'; return; }
    list.innerHTML = recentSnap.docs.map(d => {
      const a = d.data();
      return `<tr><td>${escapeHtml(a.date)}</td><td><strong>${a.totalMeals || 0}</strong></td><td>${escapeHtml(a.recordedBy || '—')}</td></tr>`;
    }).join('');
  } catch (e) { console.error(e); }
}

function setStat(id, val) { const el = document.getElementById(id); if (el) el.querySelector('.stat-value').textContent = val; }

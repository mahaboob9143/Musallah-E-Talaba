// ============================================================
// ADMIN — Activity Logs
// ============================================================

import { db } from '../firebase-config.js';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { getCurrentUserData } from '../auth.js';
import { getDashboardLayout, initSidebar } from './dashboard.js';
import { formatDateTime } from '../utils/date-utils.js';
import { escapeHtml } from '../utils/validation.js';

export function renderActivityLogs(container) {
  const user = getCurrentUserData();
  container.innerHTML = getDashboardLayout('activity-logs', 'admin', user, `
    <div class="dashboard-header">
      <div><h1 class="page-title">Activity Logs</h1><div class="page-breadcrumb"><span>Admin</span><span class="separator">/</span><span class="current">Activity Logs</span></div></div>
    </div>
    <div class="dashboard-content">
      <div class="table-toolbar">
        <div class="search-box"><input class="search-input" id="log-search" placeholder="Search logs..." /></div>
      </div>
      <div class="card"><div class="card-body"><table class="data-table"><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead><tbody id="log-list"><tr><td colspan="5" class="text-muted text-center">Loading...</td></tr></tbody></table></div></div>
    </div>
  `);

  initSidebar();
  loadLogs();
  document.getElementById('log-search')?.addEventListener('input', (e) => filterLogs(e.target.value));
}

async function loadLogs() {
  const list = document.getElementById('log-list');
  if (!list) return;

  try {
    const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(200));
    const snap = await getDocs(q);

    if (snap.empty) { list.innerHTML = '<tr><td colspan="5" class="text-muted text-center">No activity logs</td></tr>'; return; }

    list.innerHTML = snap.docs.map(d => {
      const log = d.data();
      const actionColors = { create: 'success', update: 'warning', delete: 'danger', approve: 'success', reject: 'danger', upload: 'primary', login: 'primary', logout: 'secondary' };
      const color = actionColors[log.action] || 'secondary';

      return `<tr data-search="${escapeHtml((log.userName + log.action + log.entity + log.details).toLowerCase())}">
        <td style="white-space:nowrap;font-size:0.8rem;">${log.timestamp ? formatDateTime(log.timestamp.toDate()) : '—'}</td>
        <td><strong>${escapeHtml(log.userName || '—')}</strong></td>
        <td><span class="badge badge-${color}">${escapeHtml(log.action || '—')}</span></td>
        <td>${escapeHtml(log.entity || '—')}</td>
        <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(log.details || '—')}</td>
      </tr>`;
    }).join('');
  } catch (e) { list.innerHTML = '<tr><td colspan="5" class="text-muted">Error loading logs</td></tr>'; }
}

function filterLogs(query) {
  const rows = document.querySelectorAll('#log-list tr');
  const q = query.toLowerCase();
  rows.forEach(row => {
    const searchData = row.dataset.search || '';
    row.style.display = searchData.includes(q) ? '' : 'none';
  });
}

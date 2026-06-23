// ============================================================
// ADMIN DASHBOARD — Home with stats, charts, recent activity
// ============================================================

import { db } from '../firebase-config.js';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { getCurrentUserData, logout } from '../auth.js';
import { navigateTo } from '../router.js';
import { formatNumber, formatCurrency, escapeHtml } from '../utils/validation.js';
import { timeAgo } from '../utils/date-utils.js';

export function renderAdminDashboard(container) {
    const user = getCurrentUserData();
    container.innerHTML = getDashboardLayout('dashboard', 'admin', user, `
    <div class="dashboard-header">
      <div><h1 class="page-title">Dashboard</h1><div class="page-breadcrumb"><span>Admin</span><span class="separator">/</span><span class="current">Dashboard</span></div></div>
      <div class="header-actions"><button class="btn btn-sm btn-secondary" id="refresh-btn">🔄 Refresh</button></div>
    </div>
    <div class="dashboard-content">
      <div class="dashboard-stats" id="admin-stats">
        ${renderStatCards([
        { icon: '📝', label: 'Registrations', value: '...', id: 'stat-registrations' },
        { icon: '⏳', label: 'Pending Verification', value: '...', id: 'stat-pending' },
        { icon: '💰', label: 'Money Collected', value: '...', id: 'stat-collected' },
        { icon: '📤', label: 'Expenditure', value: '...', id: 'stat-expenditure' },
        { icon: '💵', label: 'Current Balance', value: '...', id: 'stat-balance' },
        { icon: '💬', label: 'Feedback', value: '...', id: 'stat-feedback' },
        { icon: '🤲', label: 'Donation Inquiries', value: '...', id: 'stat-donations' },
        { icon: '👥', label: 'Active Volunteers', value: '...', id: 'stat-volunteers' }
    ])}
      </div>
      <div class="quick-actions">
        <a href="#/admin/settings" class="quick-action-btn"><span class="action-icon">📅</span><span class="action-label">Set Deadline</span></a>
        <a href="#/admin/gallery" class="quick-action-btn"><span class="action-icon">📸</span><span class="action-label">Upload Gallery</span></a>
        <a href="#/admin/team" class="quick-action-btn"><span class="action-icon">👤</span><span class="action-label">Create Team Member</span></a>
        <a href="#/admin/reports" class="quick-action-btn"><span class="action-icon">📊</span><span class="action-label">Generate Report</span></a>
      </div>
      <div class="charts-grid">
        <div class="chart-card"><div class="chart-header"><span class="chart-title">Registration Trend</span></div><div class="chart-canvas-container"><canvas id="reg-trend-chart"></canvas></div></div>
        <div class="chart-card"><div class="chart-header"><span class="chart-title">Zone Distribution</span></div><div class="chart-canvas-container"><canvas id="zone-chart"></canvas></div></div>
      </div>
      <div class="activity-feed card"><div class="card-header"><span class="card-title">Recent Activity</span></div><div id="activity-list"><p class="text-muted" style="padding:1rem;font-size:0.875rem;">Loading activity...</p></div></div>
    </div>
  `);

    initSidebar();
    loadAdminStats();
    loadRecentActivity();
    loadCharts();

    document.getElementById('refresh-btn')?.addEventListener('click', () => {
        loadAdminStats();
        loadRecentActivity();
    });
}

async function loadAdminStats() {
    try {
        const [regs, feedback, donations, transactions, users] = await Promise.all([
            getDocs(collection(db, 'sehri_registrations')),
            getDocs(collection(db, 'feedback_submissions')),
            getDocs(collection(db, 'donations')),
            getDocs(collection(db, 'financial_transactions')),
            getDocs(collection(db, 'users'))
        ]);

        const pending = regs.docs.filter(d => d.data().paymentStatus === 'pending').length;
        let totalCollected = 0, totalExpenditure = 0;
        transactions.docs.forEach(d => {
            const t = d.data();
            if (t.type === 'add') totalCollected += (t.amount || 0);
            if (t.type === 'deduct') totalExpenditure += (t.amount || 0);
        });

        setStatValue('stat-registrations', formatNumber(regs.size));
        setStatValue('stat-pending', formatNumber(pending));
        setStatValue('stat-collected', formatCurrency(totalCollected));
        setStatValue('stat-expenditure', formatCurrency(totalExpenditure));
        setStatValue('stat-balance', formatCurrency(totalCollected - totalExpenditure));
        setStatValue('stat-feedback', formatNumber(feedback.size));
        setStatValue('stat-donations', formatNumber(donations.size));
        const activeVolunteers = users.docs.filter(d => d.data().status === 'active').length;
        setStatValue('stat-volunteers', formatNumber(activeVolunteers));
    } catch (e) {
        console.error('Stats error:', e);
    }
}

async function loadRecentActivity() {
    try {
        const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(10));
        const snap = await getDocs(q);
        const list = document.getElementById('activity-list');
        if (!list) return;

        if (snap.empty) { list.innerHTML = '<p class="text-muted" style="padding:1rem;font-size:0.875rem;">No recent activity</p>'; return; }

        list.innerHTML = snap.docs.map(d => {
            const a = d.data();
            return `<div class="activity-item"><div class="activity-icon" style="background:var(--gold-glow);color:var(--gold);">📋</div><div class="activity-content"><div class="activity-text"><strong>${escapeHtml(a.userName || 'User')}</strong> ${escapeHtml(a.details || a.action)}</div><div class="activity-time">${a.timestamp ? timeAgo(a.timestamp.toDate()) : ''}</div></div></div>`;
        }).join('');
    } catch (e) {
        console.log('Activity load skipped:', e.message);
    }
}

async function loadCharts() {
    try {
        const { Chart, registerables } = await import('chart.js');
        Chart.register(...registerables);

        // Fetch real registration data for charts
        const regsSnap = await getDocs(collection(db, 'sehri_registrations'));
        const regs = regsSnap.docs.map(d => d.data());

        // --- Registration Trend (grouped by week) ---
        const weekCounts = {};
        regs.forEach(r => {
            if (r.submittedAt) {
                const date = r.submittedAt.toDate();
                const weekStart = new Date(date);
                weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                const key = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
                weekCounts[key] = (weekCounts[key] || 0) + 1;
            }
        });
        const weekLabels = Object.keys(weekCounts).slice(-8); // Last 8 weeks
        const weekData = weekLabels.map(k => weekCounts[k]);

        if (weekLabels.length > 0) {
            new Chart(document.getElementById('reg-trend-chart'), {
                type: 'line',
                data: { labels: weekLabels, datasets: [{ label: 'Registrations', data: weekData, borderColor: '#F4C430', backgroundColor: 'rgba(244,196,48,0.1)', tension: 0.4, fill: true }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#b0b0b0' } } }, scales: { x: { ticks: { color: '#707070' }, grid: { color: 'rgba(255,255,255,0.05)' } }, y: { ticks: { color: '#707070' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true } } }
            });
        }

        // --- Zone Distribution (from actual data) ---
        const zoneCounts = {};
        regs.forEach(r => {
            const zone = (r.zone || 'Other').split(':')[0].trim();
            zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
        });
        const zoneLabels = Object.keys(zoneCounts);
        const zoneData = zoneLabels.map(k => zoneCounts[k]);
        const zoneColors = ['#F4C430', '#ffd75e', '#c9a020', '#4CAF50', '#2196F3', '#9C27B0', '#FF5722'];

        if (zoneLabels.length > 0) {
            new Chart(document.getElementById('zone-chart'), {
                type: 'doughnut',
                data: { labels: zoneLabels, datasets: [{ data: zoneData, backgroundColor: zoneColors.slice(0, zoneLabels.length) }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#b0b0b0', padding: 15 } } } }
            });
        }
    } catch (e) { console.log('Charts skipped:', e.message); }
}

function setStatValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.querySelector('.stat-value').textContent = value;
}

function renderStatCards(cards) {
    return cards.map(c => `
    <div class="stat-card" id="${c.id}">
      <div class="stat-icon" style="background:var(--gold-glow);color:var(--gold);">${c.icon}</div>
      <div class="stat-value">${c.value}</div>
      <div class="stat-label">${c.label}</div>
    </div>
  `).join('');
}

// ---- Shared Dashboard Layout ----
export function getDashboardLayout(activePage, role, user, content) {
    const navItems = getNavItems(role);
    const rawName = user?.name || 'User';
    const name = escapeHtml(rawName);
    const initials = rawName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    return `
    <div class="dashboard-layout">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-header"><span class="sidebar-logo">🌙</span><div><div class="sidebar-title">Musallah-E-Talaba</div><div class="sidebar-role">${role.charAt(0).toUpperCase() + role.slice(1)} Panel</div></div></div>
        <nav class="sidebar-nav">${navItems.map(section => `
          <div class="sidebar-section"><div class="sidebar-section-title">${section.title}</div>${section.items.map(item => `
            <a href="#${item.path}" class="sidebar-link ${activePage === item.id ? 'active' : ''}"><span class="link-icon">${item.icon}</span><span>${item.label}</span>${item.badge ? `<span class="link-badge">${item.badge}</span>` : ''}</a>
          `).join('')}</div>
        `).join('')}</nav>
        <div class="sidebar-footer"><div class="sidebar-user" id="sidebar-user"><div class="user-avatar">${initials}</div><div><div class="user-name">${name}</div><div class="user-role">${role}</div></div></div></div>
      </aside>
      <main class="dashboard-main">
        <div class="topbar">
          <button class="mobile-sidebar-btn" id="mobile-sidebar-toggle">☰</button>
          <div class="topbar-right">
            <div class="topbar-user"><div class="user-avatar">${initials}</div><span class="topbar-user-name">${name}</span></div>
            <button class="btn btn-sm btn-danger" id="logout-btn" title="Logout">🚪 Logout</button>
          </div>
        </div>
        ${content}
      </main>
    </div>
  `;
}

function getNavItems(role) {
    if (role === 'admin') return [
        {
            title: 'Main', items: [
                { id: 'dashboard', path: '/admin', icon: '📊', label: 'Dashboard' },
                { id: 'team', path: '/admin/team', icon: '👥', label: 'Team Management' }
            ]
        },
        {
            title: 'Data', items: [
                { id: 'submissions', path: '/admin/submissions', icon: '📝', label: 'Submissions' },
                { id: 'financial', path: '/admin/financial', icon: '💰', label: 'Financial Overview' }
            ]
        },
        {
            title: 'Content', items: [
                { id: 'gallery', path: '/admin/gallery', icon: '📸', label: 'Gallery Manager' },
                { id: 'reports', path: '/admin/reports', icon: '📊', label: 'Reports' },
                { id: 'activity-logs', path: '/admin/activity-logs', icon: '📜', label: 'Activity Logs' },
                { id: 'settings', path: '/admin/settings', icon: '⚙️', label: 'Settings' }
            ]
        }
    ];
    if (role === 'financial') return [
        {
            title: 'Main', items: [
                { id: 'transactions', path: '/financial', icon: '💸', label: 'Transactions' },
                { id: 'verify', path: '/financial/verify', icon: '✅', label: 'Verifications' },
                { id: 'reports', path: '/financial/reports', icon: '📋', label: 'Reports' }
            ]
        }
    ];
    return [
        {
            title: 'Main', items: [
                { id: 'dashboard', path: '/khidmat', icon: '📊', label: 'Dashboard' },
                { id: 'attendance', path: '/khidmat/attendance', icon: '📅', label: 'Attendance' },
                { id: 'checklist', path: '/khidmat/checklist', icon: '📋', label: 'Checklist' }
            ]
        }
    ];
}

export function initSidebar() {
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await logout();
        navigateTo('/login');
    });

    document.getElementById('mobile-sidebar-toggle')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.toggle('open');
    });
}

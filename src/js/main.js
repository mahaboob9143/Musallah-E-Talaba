// ============================================================
// MAIN.JS — App Entry Point
// ============================================================

import { addRoute, initRouter, navigateTo } from './router.js';
import { onAuthChange, login, resetPassword, getDashboardPath } from './auth.js';
import { renderLandingPage, destroyLandingPage } from './landing-page.js';
import { toast } from './components/notifications.js';

// ---- Route Registration ----

// Public
addRoute('/', { title: 'Home', roles: [], render: renderLandingPage, onLeave: destroyLandingPage });

// Login
addRoute('/login', {
  title: 'Login',
  roles: [],
  render: (container) => renderLoginPage(container)
});

// Admin routes
addRoute('/admin', { title: 'Admin Dashboard', roles: ['admin'], render: async (c) => { const m = await import('./admin/dashboard.js'); m.renderAdminDashboard(c); } });
addRoute('/admin/team', { title: 'Team Management', roles: ['admin'], render: async (c) => { const m = await import('./admin/team-management.js'); m.renderTeamManagement(c); } });
addRoute('/admin/submissions', { title: 'Submissions', roles: ['admin'], render: async (c) => { const m = await import('./admin/submissions.js'); m.renderSubmissions(c); } });
addRoute('/admin/financial', { title: 'Financial Overview', roles: ['admin'], render: async (c) => { const m = await import('./admin/financial-overview.js'); m.renderFinancialOverview(c); } });
addRoute('/admin/gallery', { title: 'Gallery Manager', roles: ['admin'], render: async (c) => { const m = await import('./admin/gallery-manager.js'); m.renderGalleryManager(c); } });
addRoute('/admin/settings', { title: 'Settings', roles: ['admin'], render: async (c) => { const m = await import('./admin/settings.js'); m.renderSettings(c); } });
addRoute('/admin/reports', { title: 'Reports', roles: ['admin'], render: async (c) => { const m = await import('./admin/reports.js'); m.renderReports(c); } });
addRoute('/admin/activity-logs', { title: 'Activity Logs', roles: ['admin'], render: async (c) => { const m = await import('./admin/activity-logs.js'); m.renderActivityLogs(c); } });

// Financial routes
addRoute('/financial', { title: 'Financial Transactions', roles: ['financial', 'admin'], render: async (c) => { const m = await import('./financial/transactions.js'); m.renderTransactions(c); } });
addRoute('/financial/verify', { title: 'Verifications', roles: ['financial', 'admin'], render: async (c) => { const m = await import('./financial/verifications.js'); m.renderVerifications(c); } });
addRoute('/financial/transactions', { title: 'Transactions', roles: ['financial', 'admin'], render: async (c) => { const { navigateTo } = await import('./router.js'); navigateTo('/financial'); } });
addRoute('/financial/reports', { title: 'Financial Reports', roles: ['financial', 'admin'], render: async (c) => { const m = await import('./financial/reports.js'); m.renderFinancialReports(c); } });

// Khidmat routes
addRoute('/khidmat', { title: 'Khidmat Dashboard', roles: ['khidmat', 'admin'], render: async (c) => { const m = await import('./khidmat/dashboard.js'); m.renderKhidmatDashboard(c); } });
addRoute('/khidmat/attendance', { title: 'Attendance', roles: ['khidmat', 'admin'], render: async (c) => { const m = await import('./khidmat/attendance.js'); m.renderAttendance(c); } });
addRoute('/khidmat/checklist', { title: 'Checklist', roles: ['khidmat', 'admin'], render: async (c) => { const m = await import('./khidmat/checklist.js'); m.renderChecklist(c); } });

// ---- Initialize App ----
function hideLoadingScreen() {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.classList.add('fade-out');
    setTimeout(() => loadingScreen.remove(), 500);
  }
}

function initApp() {
  // Hide loading screen once Firebase Auth has confirmed its state.
  // The router itself also awaits authStateReady() before checking currentUser,
  // so there is no race condition on refresh.
  onAuthChange(() => hideLoadingScreen());

  // Safety net: hide loading screen after 4s regardless
  setTimeout(hideLoadingScreen, 4000);

  // Start the router — resolveRoute() inside awaits auth.authStateReady()
  initRouter();
}


// ---- Login Page Renderer ----
function renderLoginPage(container) {
  container.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-header">
          <span class="logo-icon">🌙</span>
          <h2>Musallah-E-Talaba</h2>
          <p>Team Portal Login</p>
        </div>
        <form class="login-form" id="login-form">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" name="email" class="form-control" placeholder="Enter your email" required />
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <div class="password-wrapper">
              <input type="password" name="password" id="password-input" class="form-control" placeholder="Enter your password" required />
              <button type="button" class="eye-toggle" id="eye-toggle" title="Show/Hide Password" aria-label="Toggle password visibility">👁</button>
            </div>
            <a href="#" class="forgot-link" id="forgot-password-link">Forgot Password?</a>
          </div>
          <button type="submit" class="btn btn-primary btn-block btn-lg" id="login-btn">Login</button>
        </form>
        <div class="login-footer">
          <a href="#/">← Back to Home</a>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('login-form');
  const btn = document.getElementById('login-btn');

  // Eye toggle for password visibility
  document.getElementById('eye-toggle')?.addEventListener('click', () => {
    const pwInput = document.getElementById('password-input');
    const eyeBtn = document.getElementById('eye-toggle');
    if (!pwInput) return;
    if (pwInput.type === 'password') {
      pwInput.type = 'text';
      eyeBtn.textContent = '🙈';
    } else {
      pwInput.type = 'password';
      eyeBtn.textContent = '👁';
    }
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.querySelector('[name="email"]').value;
    const password = form.querySelector('[name="password"]').value;

    if (!email || !password) { toast.error('Please fill in all fields'); return; }

    btn.disabled = true;
    btn.textContent = 'Logging in...';

    try {
      const { userData } = await login(email, password);
      toast.success(`Welcome back, ${userData.name}!`);
      const path = getDashboardPath();
      navigateTo(path);
    } catch (err) {
      toast.error(err.message);
      btn.disabled = false;
      btn.textContent = 'Login';
    }
  });

  document.getElementById('forgot-password-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    const email = form.querySelector('[name="email"]').value;
    if (!email) { toast.warning('Enter your email first, then click Forgot Password'); return; }
    resetPassword(email);
  });
}

// Start the app
document.addEventListener('DOMContentLoaded', initApp);

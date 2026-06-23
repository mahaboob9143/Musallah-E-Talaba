// ============================================================
// NOTIFICATIONS — Toast notification system
// ============================================================

let toastCounter = 0;

/**
 * Shows a toast notification
 * @param {string} message - The notification message
 * @param {string} type - 'success' | 'error' | 'warning' | 'info'
 * @param {number} duration - Duration in ms (default 4000)
 */
export function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const id = `toast-${++toastCounter}`;
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    const titles = {
        success: 'Success',
        error: 'Error',
        warning: 'Warning',
        info: 'Info'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.id = id;
    toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <div class="toast-content">
      <div class="toast-title">${titles[type]}</div>
      <div class="toast-message"></div>
    </div>
    <button class="toast-close" aria-label="Close">&times;</button>
  `;

    // Use textContent for the message to prevent XSS
    toast.querySelector('.toast-message').textContent = message;

    container.appendChild(toast);

    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => removeToast(id));

    // Auto remove
    if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
    }

    return id;
}

function removeToast(id) {
    const toast = document.getElementById(id);
    if (!toast) return;
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
}

/**
 * Convenience methods
 */
export const toast = {
    success: (msg, dur) => showToast(msg, 'success', dur),
    error: (msg, dur) => showToast(msg, 'error', dur),
    warning: (msg, dur) => showToast(msg, 'warning', dur),
    info: (msg, dur) => showToast(msg, 'info', dur)
};

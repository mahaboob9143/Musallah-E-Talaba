// ============================================================
// MODAL — Reusable modal dialog component
// ============================================================

let activeModal = null;

/**
 * Opens a modal dialog
 * @param {Object} options
 * @param {string} options.title - Modal title
 * @param {string} options.content - HTML content for body
 * @param {string} [options.size] - 'sm' | 'md' | 'lg' | 'xl'
 * @param {Array} [options.actions] - Footer buttons [{label, class, onClick}]
 * @param {Function} [options.onClose] - Callback when modal closes
 */
export function openModal({ title, content, size = 'md', actions = [], onClose = null }) {
    closeModal(); // Close any existing

    const overlay = document.getElementById('modal-overlay');
    const sizeClass = size === 'md' ? '' : `modal-${size}`;

    const modal = document.createElement('div');
    modal.className = `modal ${sizeClass}`;
    modal.id = 'active-modal';

    let footerHtml = '';
    if (actions.length > 0) {
        const btns = actions.map((a, i) =>
            `<button class="btn ${a.class || 'btn-secondary'}" data-action-idx="${i}">${a.label}</button>`
        ).join('');
        footerHtml = `<div class="modal-footer">${btns}</div>`;
    }

    modal.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">${title}</h3>
      <button class="modal-close" aria-label="Close modal">&times;</button>
    </div>
    <div class="modal-body">${content}</div>
    ${footerHtml}
  `;

    document.body.appendChild(modal);

    // Event listeners
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    actions.forEach((a, i) => {
        const btn = modal.querySelector(`[data-action-idx="${i}"]`);
        if (btn && a.onClick) {
            btn.addEventListener('click', () => a.onClick(modal));
        }
    });

    // Escape key
    const escHandler = (e) => {
        if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', escHandler);

    // Show with animation
    requestAnimationFrame(() => {
        overlay.classList.add('active');
        modal.classList.add('active');
    });

    activeModal = { modal, overlay, escHandler, onClose };

    return modal;
}

/**
 * Closes the active modal
 */
export function closeModal() {
    if (!activeModal) return;

    const { modal, overlay, escHandler, onClose } = activeModal;

    overlay.classList.remove('active');
    modal.classList.remove('active');
    document.removeEventListener('keydown', escHandler);

    setTimeout(() => {
        modal.remove();
        if (onClose) onClose();
    }, 300);

    activeModal = null;
}

/**
 * Confirm dialog helper
 */
export function confirmModal({ title, message, confirmLabel = 'Confirm', confirmClass = 'btn-danger', onConfirm }) {
    return openModal({
        title,
        content: `<p style="color: var(--text-secondary); line-height: 1.6;">${message}</p>`,
        actions: [
            { label: 'Cancel', class: 'btn-secondary', onClick: closeModal },
            { label: confirmLabel, class: confirmClass, onClick: () => { closeModal(); onConfirm(); } }
        ]
    });
}

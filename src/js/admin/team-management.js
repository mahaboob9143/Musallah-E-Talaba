// ============================================================
// ADMIN — Team Management
// ============================================================

import { db } from '../firebase-config.js';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, getDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getCurrentUserData } from '../auth.js';
import { getDashboardLayout, initSidebar } from './dashboard.js';
import { toast } from '../components/notifications.js';
import { openModal, closeModal, confirmModal } from '../components/modal.js';
import { validateForm, showFormErrors, sanitize, escapeHtml } from '../utils/validation.js';
import { logAction, ACTIONS, ENTITIES } from '../utils/audit-logger.js';
import { formatDate } from '../utils/date-utils.js';

// Module-level store for all team members (for client-side filtering)
let allMembers = [];

export function renderTeamManagement(container) {
    const user = getCurrentUserData();
    container.innerHTML = getDashboardLayout('team', 'admin', user, `
    <div class="dashboard-header">
      <div><h1 class="page-title">Team Management</h1><div class="page-breadcrumb"><span>Admin</span><span class="separator">/</span><span class="current">Team</span></div></div>
      <div class="header-actions"><button class="btn btn-primary" id="add-member-btn">+ Add Member</button></div>
    </div>
    <div class="dashboard-content">
      <div class="card"><div class="card-body">
        <div class="table-toolbar">
          <div class="toolbar-left">
            <input type="text" class="search-input" id="team-search" placeholder="🔍 Search by name or email..." />
            <select class="filter-select" id="team-role-filter">
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="financial">Financial</option>
              <option value="khidmat">Khidmat</option>
            </select>
            <select class="filter-select" id="team-status-filter">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
          <div class="toolbar-right">
            <span class="text-muted" id="team-count-label" style="font-size:0.85rem;"></span>
          </div>
        </div>
        <table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody id="team-list"><tr><td colspan="6" class="text-center text-muted">Loading...</td></tr></tbody></table>
      </div></div>
    </div>
  `);

    initSidebar();
    loadTeamMembers();
    document.getElementById('add-member-btn')?.addEventListener('click', () => showAddMemberModal());

    // Filter event listeners
    document.getElementById('team-search')?.addEventListener('input', applyFilters);
    document.getElementById('team-role-filter')?.addEventListener('change', applyFilters);
    document.getElementById('team-status-filter')?.addEventListener('change', applyFilters);
}

function applyFilters() {
    const searchTerm = (document.getElementById('team-search')?.value || '').toLowerCase().trim();
    const roleFilter = document.getElementById('team-role-filter')?.value || '';
    const statusFilter = document.getElementById('team-status-filter')?.value || '';

    let filtered = allMembers;

    if (searchTerm) {
        filtered = filtered.filter(m =>
            (m.data.name || '').toLowerCase().includes(searchTerm) ||
            (m.data.email || '').toLowerCase().includes(searchTerm)
        );
    }
    if (roleFilter) {
        filtered = filtered.filter(m => (m.data.role || []).includes(roleFilter));
    }
    if (statusFilter) {
        filtered = filtered.filter(m => (m.data.status || 'active') === statusFilter);
    }

    renderMemberRows(filtered);
}

function renderMemberRows(members) {
    const list = document.getElementById('team-list');
    const countLabel = document.getElementById('team-count-label');
    if (!list) return;

    if (countLabel) countLabel.textContent = `${members.length} of ${allMembers.length} members`;

    if (members.length === 0) {
        list.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No matching members</td></tr>';
        return;
    }

    list.innerHTML = members.map(m => {
        const u = m.data;
        const roles = (u.role || []).join(', ');
        const statusClass = u.status === 'active' ? 'success' : 'danger';
        return `<tr>
        <td><strong>${escapeHtml(u.name || '—')}</strong></td><td>${escapeHtml(u.email || '—')}</td>
        <td><span class="badge badge-${roles.includes('admin') ? 'warning' : 'primary'}">${escapeHtml(roles)}</span></td>
        <td><span class="badge badge-${statusClass}">${escapeHtml(u.status || 'active')}</span></td>
        <td>${u.createdAt ? formatDate(u.createdAt.toDate()) : '—'}</td>
        <td><button class="btn btn-sm btn-secondary edit-member" data-id="${m.id}">Edit</button> <button class="btn btn-sm btn-danger delete-member" data-id="${m.id}" data-name="${escapeHtml(u.name)}">Delete</button></td>
      </tr>`;
    }).join('');

    list.querySelectorAll('.edit-member').forEach(btn => btn.addEventListener('click', () => showEditMemberModal(btn.dataset.id)));
    list.querySelectorAll('.delete-member').forEach(btn => btn.addEventListener('click', () => handleDeleteMember(btn.dataset.id, btn.dataset.name)));
}

async function loadTeamMembers() {
    const list = document.getElementById('team-list');
    if (!list) return;

    try {
        const snap = await getDocs(collection(db, 'users'));
        if (snap.empty) {
            allMembers = [];
            list.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No team members yet</td></tr>';
            return;
        }

        allMembers = snap.docs.map(d => ({ id: d.id, data: d.data() }));
        applyFilters();
    } catch (e) { list.innerHTML = '<tr><td colspan="6" class="text-muted">Error loading team</td></tr>'; }
}

function showAddMemberModal() {
    openModal({
        title: 'Add Team Member',
        content: `<form id="member-form">
      <div class="form-group"><label class="form-label">Full Name *</label><input name="name" class="form-control" placeholder="Name" /><div class="form-error" data-error="name"></div></div>
      <div class="form-group"><label class="form-label">Email *</label><input name="email" class="form-control" type="email" placeholder="Email" /><div class="form-error" data-error="email"></div></div>
      <div class="form-group"><label class="form-label">Password *</label><input name="password" class="form-control" type="password" placeholder="Min 6 characters" /><div class="form-error" data-error="password"></div></div>
      <div class="form-group"><label class="form-label">Role *</label><select name="role" class="form-control"><option value="">Select Role</option><option value="admin">Admin</option><option value="financial">Financial Team</option><option value="khidmat">Khidmat Team</option></select><div class="form-error" data-error="role"></div></div>
    </form>`,
        actions: [
            { label: 'Cancel', class: 'btn-secondary', onClick: closeModal },
            { label: 'Add Member', class: 'btn-primary', onClick: handleAddMember }
        ]
    });
}

async function handleAddMember(modal) {
    const form = modal.querySelector('#member-form');
    const data = Object.fromEntries(new FormData(form));
    const errors = validateForm([
        { name: 'name', value: data.name, rules: [{ required: true }] },
        { name: 'email', value: data.email, rules: [{ required: true }, { email: true }] },
        { name: 'password', value: data.password, rules: [{ required: true }, { minLength: 6 }] },
        { name: 'role', value: data.role, rules: [{ required: true }] }
    ]);
    if (Object.keys(errors).length) { showFormErrors(errors, form); return; }

    // Use a secondary Firebase app so the current admin doesn't get signed out
    let secondaryApp = null;
    try {
        toast.info('Creating account...');
        const { default: mainApp } = await import('../firebase-config.js');
        secondaryApp = initializeApp(mainApp.options, 'Secondary');
        const secondaryAuth = getAuth(secondaryApp);

        const cred = await createUserWithEmailAndPassword(secondaryAuth, data.email, data.password);
        const uid = cred.user.uid;

        // Sign out from secondary app immediately
        await secondaryAuth.signOut();

        // Store user doc with Auth UID as document ID
        await setDoc(doc(db, 'users', uid), {
            name: sanitize(data.name), email: sanitize(data.email), role: [data.role],
            status: 'active', createdAt: serverTimestamp()
        });
        await logAction({ action: ACTIONS.CREATE, entity: ENTITIES.USER, details: `Added team member: ${data.name} (${data.role})` });
        toast.success('Team member added with login credentials!');
        closeModal();
        loadTeamMembers();
    } catch (e) {
        const msg = e.code === 'auth/email-already-in-use' ? 'This email is already in use' : e.message;
        toast.error('Failed: ' + msg);
    } finally {
        if (secondaryApp) {
            try { await deleteApp(secondaryApp); } catch (_) { /* ignore */ }
        }
    }
}

async function showEditMemberModal(id) {
    const snap = await getDoc(doc(db, 'users', id));
    if (!snap.exists()) { toast.error('Member not found'); return; }
    const u = snap.data();

    openModal({
        title: 'Edit Member',
        content: `<form id="member-form">
      <div class="form-group"><label class="form-label">Name</label><input name="name" class="form-control" value="${escapeHtml(u.name || '')}" /></div>
      <div class="form-group"><label class="form-label">Role</label><select name="role" class="form-control"><option value="admin" ${u.role?.includes('admin') ? 'selected' : ''}>Admin</option><option value="financial" ${u.role?.includes('financial') ? 'selected' : ''}>Financial</option><option value="khidmat" ${u.role?.includes('khidmat') ? 'selected' : ''}>Khidmat</option></select></div>
      <div class="form-group"><label class="form-label">Status</label><select name="status" class="form-control"><option value="active" ${u.status === 'active' ? 'selected' : ''}>Active</option><option value="disabled" ${u.status === 'disabled' ? 'selected' : ''}>Disabled</option></select></div>
    </form>`,
        actions: [
            { label: 'Cancel', class: 'btn-secondary', onClick: closeModal },
            {
                label: 'Save', class: 'btn-primary', onClick: async (modal) => {
                    const form = modal.querySelector('#member-form');
                    const data = Object.fromEntries(new FormData(form));
                    await updateDoc(doc(db, 'users', id), { name: sanitize(data.name), role: [data.role], status: data.status });
                    await logAction({ action: ACTIONS.UPDATE, entity: ENTITIES.USER, entityId: id, details: `Updated ${data.name}` });
                    toast.success('Member updated!');
                    closeModal(); loadTeamMembers();
                }
            }
        ]
    });
}

async function handleDeleteMember(id, name) {
    confirmModal({
        title: 'Delete Member',
        message: `Are you sure you want to delete <strong>${escapeHtml(name)}</strong>? This cannot be undone.`,
        confirmLabel: 'Delete',
        onConfirm: async () => {
            await deleteDoc(doc(db, 'users', id));
            await logAction({ action: ACTIONS.DELETE, entity: ENTITIES.USER, entityId: id, details: `Deleted ${name}` });
            toast.success('Member deleted');
            loadTeamMembers();
        }
    });
}

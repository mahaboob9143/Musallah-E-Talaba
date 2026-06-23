// ============================================================
// KHIDMAT — Checklist Management
// ============================================================

import { db } from '../firebase-config.js';
import { collection, getDocs, doc, setDoc, getDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { getCurrentUserData } from '../auth.js';
import { getDashboardLayout, initSidebar } from '../admin/dashboard.js';
import { toast } from '../components/notifications.js';
import { logAction, ACTIONS, ENTITIES } from '../utils/audit-logger.js';
import { getToday, formatDate } from '../utils/date-utils.js';

const DEFAULT_ITEMS = [
  { id: 'rice', name: 'Rice', quantity: '10 kg', category: 'Food' },
  { id: 'dates', name: 'Dates', quantity: '5 kg', category: 'Food' },
  { id: 'milk', name: 'Milk Packets', quantity: '50 packets', category: 'Food' },
  { id: 'bread', name: 'Bread', quantity: '30 packs', category: 'Food' },
  { id: 'water', name: 'Water Bottles', quantity: '100 bottles', category: 'Supplies' },
  { id: 'plates', name: 'Plates', quantity: '200', category: 'Supplies' },
  { id: 'glasses', name: 'Glasses', quantity: '200', category: 'Supplies' },
  { id: 'packaging', name: 'Packaging Material', quantity: 'As needed', category: 'Supplies' },
  { id: 'cleaning', name: 'Cleaning Supplies', quantity: 'As needed', category: 'Cleaning' },
  { id: 'garbage', name: 'Garbage Bags', quantity: '20', category: 'Cleaning' }
];

export function renderChecklist(container) {
  const user = getCurrentUserData();
  container.innerHTML = getDashboardLayout('checklist', 'khidmat', user, `
    <div class="dashboard-header">
      <div><h1 class="page-title">Today's Checklist</h1></div>
      <div class="header-actions"><span class="text-muted">${formatDate(new Date())}</span></div>
    </div>
    <div class="dashboard-content">
      <div class="checklist-wrapper" id="checklist-wrapper">
        <div class="checklist-header"><span style="font-weight:600;">Item</span><span style="font-weight:600;">Status</span></div>
        <div id="checklist-items"><p class="text-muted" style="padding:1rem;">Loading...</p></div>
      </div>
      <div style="margin-top:var(--space-4); display:flex; gap:var(--space-3);">
        <button class="btn btn-primary" id="save-checklist">💾 Save Checklist</button>
        <button class="btn btn-secondary" id="reset-checklist">🔄 Reset</button>
      </div>
    </div>
  `);

  initSidebar();
  loadChecklist();
  document.getElementById('save-checklist')?.addEventListener('click', saveChecklist);
  document.getElementById('reset-checklist')?.addEventListener('click', resetChecklist);
}

/**
 * Loads checklist templates from Firestore first, falls back to DEFAULT_ITEMS
 */
async function getTemplateItems() {
  try {
    const snap = await getDocs(query(collection(db, 'checklist_templates'), orderBy('order', 'asc')));
    if (!snap.empty) {
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  } catch (e) { /* fall through to defaults */ }
  return DEFAULT_ITEMS;
}

async function loadChecklist() {
  const itemsContainer = document.getElementById('checklist-items');
  if (!itemsContainer) return;

  const today = getToday();
  let savedChecklist = {};

  try {
    const snap = await getDoc(doc(db, 'daily_checklists', today));
    if (snap.exists()) savedChecklist = snap.data().items || {};
  } catch (e) { /* use defaults */ }

  const templateItems = await getTemplateItems();

  itemsContainer.innerHTML = templateItems.map(item => {
    const saved = savedChecklist[item.id];
    const isChecked = saved?.status === 'available';
    const isUnavailable = saved?.status === 'unavailable';

    return `
      <div class="checklist-item" data-id="${item.id}">
        <button class="checklist-checkbox ${isChecked ? 'checked' : isUnavailable ? 'unavailable' : ''}" data-id="${item.id}" data-status="${isChecked ? 'available' : isUnavailable ? 'unavailable' : 'pending'}">
          ${isChecked ? '✓' : isUnavailable ? '✕' : ''}
        </button>
        <div class="checklist-info">
          <div class="checklist-name">${item.name}</div>
          <div class="checklist-qty">${item.quantity || '—'} · ${item.category || '—'}</div>
        </div>
        <span class="checklist-status ${isChecked ? 'available' : isUnavailable ? 'unavailable' : ''}">
          ${isChecked ? 'Available' : isUnavailable ? 'Unavailable' : '—'}
        </span>
      </div>
    `;
  }).join('');

  // Toggle handler
  itemsContainer.querySelectorAll('.checklist-checkbox').forEach(btn => {
    btn.addEventListener('click', () => toggleCheckbox(btn));
  });
}

function toggleCheckbox(btn) {
  const current = btn.dataset.status;
  let next, icon, text, cls;

  if (current === 'pending') { next = 'available'; icon = '✓'; text = 'Available'; cls = 'checked'; }
  else if (current === 'available') { next = 'unavailable'; icon = '✕'; text = 'Unavailable'; cls = 'unavailable'; }
  else { next = 'pending'; icon = ''; text = '—'; cls = ''; }

  btn.dataset.status = next;
  btn.className = `checklist-checkbox ${cls}`;
  btn.textContent = icon;

  const parent = btn.closest('.checklist-item');
  const statusEl = parent.querySelector('.checklist-status');
  if (statusEl) {
    statusEl.className = `checklist-status ${cls}`;
    statusEl.textContent = text;
  }
}

async function saveChecklist() {
  const today = getToday();
  const items = {};
  document.querySelectorAll('.checklist-checkbox').forEach(btn => {
    items[btn.dataset.id] = { status: btn.dataset.status };
  });

  const user = getCurrentUserData();
  try {
    await setDoc(doc(db, 'daily_checklists', today), {
      date: today, items,
      savedBy: user?.name || '',
      updatedAt: serverTimestamp()
    }, { merge: true });
    await logAction({ action: ACTIONS.UPDATE, entity: ENTITIES.CHECKLIST, entityId: today, details: 'Updated daily checklist' });
    toast.success('Checklist saved!');
  } catch (e) { toast.error('Save failed'); }
}

function resetChecklist() {
  document.querySelectorAll('.checklist-checkbox').forEach(btn => {
    btn.dataset.status = 'pending';
    btn.className = 'checklist-checkbox';
    btn.textContent = '';
  });
  document.querySelectorAll('.checklist-status').forEach(el => {
    el.className = 'checklist-status';
    el.textContent = '—';
  });
  toast.info('Checklist reset');
}

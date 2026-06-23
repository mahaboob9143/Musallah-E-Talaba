// ============================================================
// ADMIN — Settings Page
// ============================================================

import { db } from '../firebase-config.js';
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs, addDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { getCurrentUserData } from '../auth.js';
import { getDashboardLayout, initSidebar } from './dashboard.js';
import { toast } from '../components/notifications.js';
import { logAction, ACTIONS, ENTITIES } from '../utils/audit-logger.js';
import { escapeHtml } from '../utils/validation.js';

export async function renderSettings(container) {
  const user = getCurrentUserData();

  let settings = { registrationDeadline: '', upiId: '', whatsappGroupLink: '', contactPhone: '', mapEmbedUrl: '', formsEnabled: { sehriRegistration: true, feedback: true, donation: true }, impactStats: { peopleHelpedThisYear: 0, totalHelped: 0, mealsDistributed: 0, yearsOfService: 0 } };
  try {
    const snap = await getDoc(doc(db, 'system_settings', 'settings'));
    if (snap.exists()) settings = { ...settings, ...snap.data() };
  } catch (e) { /* use defaults */ }

  container.innerHTML = getDashboardLayout('settings', 'admin', user, `
    <div class="dashboard-header">
      <div><h1 class="page-title">Settings</h1><div class="page-breadcrumb"><span>Admin</span><span class="separator">/</span><span class="current">Settings</span></div></div>
    </div>
    <div class="dashboard-content">
      <form id="settings-form">
        <div class="settings-section">
          <h3 class="settings-title">Registration</h3>
          <div class="form-group"><label class="form-label">Registration Deadline</label><input name="registrationDeadline" class="form-control" type="datetime-local" value="${escapeHtml(settings.registrationDeadline || '')}" /></div>
          <div class="form-group"><label class="form-label">UPI ID</label><input name="upiId" class="form-control" value="${escapeHtml(settings.upiId || '')}" placeholder="e.g. 8500689592@ybl" /></div>
          <div class="form-group"><label class="form-label">Registration Fee (₹)</label><input name="registrationFee" class="form-control" type="number" value="${settings.registrationFee || 1200}" /></div>
        </div>
        <div class="settings-section">
          <h3 class="settings-title">Contact & Community</h3>
          <div class="form-group"><label class="form-label">WhatsApp Group Link</label><input name="whatsappGroupLink" class="form-control" value="${escapeHtml(settings.whatsappGroupLink || '')}" placeholder="https://chat.whatsapp.com/..." /></div>
          <div class="form-group"><label class="form-label">Contact Phone</label><input name="contactPhone" class="form-control" value="${escapeHtml(settings.contactPhone || '')}" placeholder="9876543210" /></div>
          <div class="form-group"><label class="form-label">Google Maps Embed URL</label><input name="mapEmbedUrl" class="form-control" value="${escapeHtml(settings.mapEmbedUrl || '')}" placeholder="https://www.google.com/maps/embed?pb=..." /><small class="text-muted">Paste the src URL from a Google Maps embed iframe</small></div>
        </div>
        <div class="settings-section">
          <h3 class="settings-title">Impact Stats (Landing Page)</h3>
          <p class="text-muted" style="margin-bottom:var(--space-4);font-size:0.9rem;">These values are displayed in the "Our Impact" section on the public landing page.</p>
          <div class="form-group"><label class="form-label">People Helped This Year</label><input name="peopleHelpedThisYear" class="form-control" type="number" min="0" value="${settings.impactStats?.peopleHelpedThisYear || 0}" /></div>
          <div class="form-group"><label class="form-label">Total Helped (All Years)</label><input name="totalHelped" class="form-control" type="number" min="0" value="${settings.impactStats?.totalHelped || 0}" /></div>
          <div class="form-group"><label class="form-label">Meals Distributed</label><input name="mealsDistributed" class="form-control" type="number" min="0" value="${settings.impactStats?.mealsDistributed || 0}" /></div>
          <div class="form-group"><label class="form-label">Years of Service</label><input name="yearsOfService" class="form-control" type="number" min="0" value="${settings.impactStats?.yearsOfService || 0}" /></div>
        </div>
        <div class="settings-section">
          <h3 class="settings-title">Form Toggles</h3>
          <div class="form-group"><label><input type="checkbox" name="sehriRegistration" ${settings.formsEnabled?.sehriRegistration ? 'checked' : ''} /> Enable Sehri Registration Form</label></div>
          <div class="form-group"><label><input type="checkbox" name="feedback" ${settings.formsEnabled?.feedback ? 'checked' : ''} /> Enable Feedback Form</label></div>
          <div class="form-group"><label><input type="checkbox" name="donation" ${settings.formsEnabled?.donation ? 'checked' : ''} /> Enable Donation Inquiry Form</label></div>
        </div>
        <button type="submit" class="btn btn-primary btn-lg">Save Settings</button>
      </form>

      <div class="settings-section" style="margin-top:var(--space-8);">
        <h3 class="settings-title">Checklist Templates</h3>
        <p class="text-muted" style="margin-bottom:var(--space-4);font-size:0.9rem;">Default items for the Khidmat team's daily checklist.</p>
        <div id="template-list" style="margin-bottom:var(--space-4);"><p class="text-muted">Loading...</p></div>
        <div style="display:flex;gap:var(--space-3);flex-wrap:wrap;align-items:flex-end;">
          <div class="form-group" style="margin:0;flex:1;min-width:120px;"><label class="form-label">Item Name *</label><input id="tpl-name" class="form-control" placeholder="e.g. Rice" /></div>
          <div class="form-group" style="margin:0;flex:1;min-width:100px;"><label class="form-label">Quantity</label><input id="tpl-qty" class="form-control" placeholder="e.g. 50kg" /></div>
          <div class="form-group" style="margin:0;flex:1;min-width:100px;"><label class="form-label">Category</label><input id="tpl-cat" class="form-control" placeholder="e.g. Food" /></div>
          <button class="btn btn-primary" id="add-template-btn" style="height:40px;">+ Add</button>
        </div>
      </div>
    </div>
  `);

  initSidebar();
  loadChecklistTemplates();

  document.getElementById('add-template-btn')?.addEventListener('click', addChecklistTemplate);

  document.getElementById('settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const data = Object.fromEntries(new FormData(form));
    const updated = {
      registrationDeadline: data.registrationDeadline || null,
      upiId: data.upiId || '',
      registrationFee: Number(data.registrationFee) || 1200,
      whatsappGroupLink: data.whatsappGroupLink || '',
      contactPhone: data.contactPhone || '',
      mapEmbedUrl: data.mapEmbedUrl || '',
      formsEnabled: {
        sehriRegistration: !!form.querySelector('[name="sehriRegistration"]').checked,
        feedback: !!form.querySelector('[name="feedback"]').checked,
        donation: !!form.querySelector('[name="donation"]').checked
      },
      impactStats: {
        peopleHelpedThisYear: Number(data.peopleHelpedThisYear) || 0,
        totalHelped: Number(data.totalHelped) || 0,
        mealsDistributed: Number(data.mealsDistributed) || 0,
        yearsOfService: Number(data.yearsOfService) || 0
      },
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(doc(db, 'system_settings', 'settings'), updated, { merge: true });
      await logAction({ action: ACTIONS.UPDATE, entity: ENTITIES.SETTINGS, details: 'Updated system settings' });
      toast.success('Settings saved!');
    } catch (err) { toast.error('Failed to save: ' + err.message); }
  });
}

// ---- Checklist Templates ----

async function loadChecklistTemplates() {
  const list = document.getElementById('template-list');
  if (!list) return;

  try {
    let snap;
    try {
      snap = await getDocs(query(collection(db, 'checklist_templates'), orderBy('order', 'asc')));
    } catch (_) {
      // Fallback if orderBy index is not available
      snap = await getDocs(collection(db, 'checklist_templates'));
    }
    if (snap.empty) {
      list.innerHTML = '<p class="text-muted" style="font-size:0.9rem;">No templates yet. Add items below.</p>';
      return;
    }
    list.innerHTML = snap.docs.map(d => {
      const t = d.data();
      return `<div class="checklist-template-row" style="display:flex;align-items:center;gap:var(--space-3);padding:0.5rem 0;border-bottom:1px solid var(--border-color);">
        <span style="flex:1;font-weight:500;">${escapeHtml(t.name)}</span>
        <span class="text-muted" style="flex:1;">${escapeHtml(t.quantity || '—')}</span>
        <span class="text-muted" style="flex:1;">${escapeHtml(t.category || '—')}</span>
        <button class="btn btn-sm btn-danger delete-tpl" data-id="${d.id}">✕</button>
      </div>`;
    }).join('');

    list.querySelectorAll('.delete-tpl').forEach(btn => {
      btn.addEventListener('click', () => deleteChecklistTemplate(btn.dataset.id));
    });
  } catch (e) { list.innerHTML = '<p class="text-muted">Error loading templates</p>'; }
}

async function addChecklistTemplate() {
  const nameEl = document.getElementById('tpl-name');
  const qtyEl = document.getElementById('tpl-qty');
  const catEl = document.getElementById('tpl-cat');
  const name = nameEl?.value?.trim();
  if (!name) { toast.error('Item name is required'); return; }

  try {
    const snap = await getDocs(collection(db, 'checklist_templates'));
    const order = snap.size + 1;

    await addDoc(collection(db, 'checklist_templates'), {
      name,
      quantity: qtyEl?.value?.trim() || '',
      category: catEl?.value?.trim() || '',
      order,
      createdAt: serverTimestamp()
    });
    await logAction({ action: ACTIONS.CREATE, entity: ENTITIES.CHECKLIST, details: `Added checklist template: ${name}` });
    toast.success('Template item added!');
    if (nameEl) nameEl.value = '';
    if (qtyEl) qtyEl.value = '';
    if (catEl) catEl.value = '';
    loadChecklistTemplates();
  } catch (e) { toast.error('Failed to add: ' + e.message); }
}

async function deleteChecklistTemplate(id) {
  try {
    await deleteDoc(doc(db, 'checklist_templates', id));
    await logAction({ action: ACTIONS.DELETE, entity: ENTITIES.CHECKLIST, entityId: id, details: 'Deleted checklist template item' });
    toast.success('Item removed');
    loadChecklistTemplates();
  } catch (e) { toast.error('Failed to delete'); }
}

// ============================================================
// ADMIN — Gallery Manager
// ============================================================

import { db, storage } from '../firebase-config.js';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getCurrentUserData } from '../auth.js';
import { getDashboardLayout, initSidebar } from './dashboard.js';
import { toast } from '../components/notifications.js';
import { openModal, closeModal, confirmModal } from '../components/modal.js';
import { logAction, ACTIONS, ENTITIES } from '../utils/audit-logger.js';
import { escapeHtml } from '../utils/validation.js';

export function renderGalleryManager(container) {
    const user = getCurrentUserData();
    container.innerHTML = getDashboardLayout('gallery', 'admin', user, `
    <div class="dashboard-header">
      <div><h1 class="page-title">Gallery Manager</h1><div class="page-breadcrumb"><span>Admin</span><span class="separator">/</span><span class="current">Gallery</span></div></div>
      <div class="header-actions"><button class="btn btn-primary" id="upload-btn">📸 Upload Photo</button><button class="btn btn-secondary" id="upload-year-btn">📅 Add Year Photo</button></div>
    </div>
    <div class="dashboard-content">
      <h3 style="margin-bottom:var(--space-4);">Gallery Photos</h3>
      <div class="gallery-grid" id="admin-gallery"><p class="text-muted">Loading...</p></div>
      <h3 style="margin:var(--space-8) 0 var(--space-4);">Year-Wise Photos</h3>
      <div class="gallery-grid" id="admin-year-photos"><p class="text-muted">Loading...</p></div>
    </div>
  `);

    initSidebar();
    loadGalleryPhotos();
    loadYearPhotos();
    document.getElementById('upload-btn')?.addEventListener('click', () => showUploadModal('gallery_images'));
    document.getElementById('upload-year-btn')?.addEventListener('click', () => showUploadModal('year_photos'));
}

async function loadGalleryPhotos() {
    const grid = document.getElementById('admin-gallery');
    try {
        const snap = await getDocs(query(collection(db, 'gallery_images'), orderBy('order', 'asc')));
        if (snap.empty) { grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📷</div><p>No gallery photos</p></div>'; return; }
        grid.innerHTML = snap.docs.map(d => {
            const data = d.data();
            return `<div class="gallery-item" style="position:relative;"><img src="${data.imageUrl}" alt="${escapeHtml(data.caption || '')}" loading="lazy" /><div class="gallery-overlay"><span class="gallery-caption">${escapeHtml(data.caption || '')}</span></div><div class="gallery-actions" style="position:absolute;top:8px;right:8px;display:flex;gap:4px;"><button class="btn btn-sm btn-secondary edit-order" data-id="${d.id}" data-collection="gallery_images" data-order="${data.order || 0}" data-caption="${escapeHtml(data.caption || '')}" title="Edit Order (#${data.order || 0})">✏️ ${data.order ?? 0}</button><button class="btn btn-sm btn-danger delete-gallery" data-id="${d.id}" data-collection="gallery_images">✕</button></div></div>`;
        }).join('');
        attachGalleryListeners(grid);
    } catch (e) { grid.innerHTML = '<p class="text-muted">Error loading</p>'; }
}

async function loadYearPhotos() {
    const grid = document.getElementById('admin-year-photos');
    try {
        const snap = await getDocs(query(collection(db, 'year_photos'), orderBy('year', 'desc')));
        if (snap.empty) { grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📸</div><p>No year photos</p></div>'; return; }
        grid.innerHTML = snap.docs.map(d => {
            const data = d.data();
            return `<div class="gallery-item" style="position:relative;"><img src="${data.imageUrl}" alt="${escapeHtml(data.caption || '')}" loading="lazy" /><div class="gallery-overlay"><span class="gallery-caption">${escapeHtml(data.year)} - ${escapeHtml(data.caption || '')}</span></div><div class="gallery-actions" style="position:absolute;top:8px;right:8px;display:flex;gap:4px;"><button class="btn btn-sm btn-secondary edit-order" data-id="${d.id}" data-collection="year_photos" data-order="${data.order || 0}" data-caption="${escapeHtml(data.caption || '')}" title="Edit Order (#${data.order || 0})">✏️ ${data.order ?? 0}</button><button class="btn btn-sm btn-danger delete-gallery" data-id="${d.id}" data-collection="year_photos">✕</button></div></div>`;
        }).join('');
        attachGalleryListeners(grid);
    } catch (e) { grid.innerHTML = '<p class="text-muted">Error loading</p>'; }
}

function attachGalleryListeners(grid) {
    grid.querySelectorAll('.delete-gallery').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); handleDelete(btn.dataset.id, btn.dataset.collection); }));
    grid.querySelectorAll('.edit-order').forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showEditOrderModal(btn.dataset.id, btn.dataset.collection, parseInt(btn.dataset.order || '0'), btn.dataset.caption || '');
    }));
}

function showEditOrderModal(docId, collectionName, currentOrder, caption) {
    openModal({
        title: '✏️ Edit Display Order',
        content: `<form id="edit-order-form">
      <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:var(--space-4);">${caption ? `Photo: <strong>${escapeHtml(caption)}</strong>` : 'Selected photo'}</p>
      <div class="form-group"><label class="form-label">Display Order</label><input name="order" class="form-control" type="number" value="${currentOrder}" /><div class="form-hint" style="font-size:0.75rem;color:var(--text-tertiary);margin-top:4px;">Lower numbers appear first.</div></div>
    </form>`,
        actions: [
            { label: 'Cancel', class: 'btn-secondary', onClick: closeModal },
            { label: 'Save', class: 'btn-primary', onClick: (modal) => handleEditOrder(modal, docId, collectionName) }
        ]
    });
}

async function handleEditOrder(modal, docId, collectionName) {
    const form = modal.querySelector('#edit-order-form');
    const newOrder = parseInt(form.querySelector('[name="order"]')?.value || '0');
    try {
        await updateDoc(doc(db, collectionName, docId), { order: newOrder });
        toast.success('Order updated!');
        closeModal();
        if (collectionName === 'gallery_images') loadGalleryPhotos(); else loadYearPhotos();
    } catch (e) { toast.error('Failed to update: ' + e.message); }
}

async function showUploadModal(collectionName) {
    const isYear = collectionName === 'year_photos';

    // Auto-calculate next order value from existing photos
    let nextOrder = 0;
    try {
        const existing = await getDocs(collection(db, collectionName));
        let maxOrder = -1;
        existing.docs.forEach(d => {
            const o = d.data().order;
            if (typeof o === 'number' && o > maxOrder) maxOrder = o;
        });
        nextOrder = maxOrder + 1;
    } catch (e) { /* default to 0 */ }

    openModal({
        title: isYear ? 'Add Year Photo' : 'Upload Gallery Photo',
        content: `<form id="upload-form">
      <div class="form-group"><label class="form-label">Photo * <span style="font-size:0.75rem;color:var(--text-tertiary);">(max 1 MB)</span></label><input type="file" name="photo" class="form-control" accept="image/*" required /></div>
      <div class="form-group"><label class="form-label">Caption</label><input name="caption" class="form-control" placeholder="Optional caption" /></div>
      ${isYear ? '<div class="form-group"><label class="form-label">Year *</label><input name="year" class="form-control" type="number" placeholder="e.g. 2025" required /></div>' : ''}
      <div class="form-group"><label class="form-label">Display Order</label><input name="order" class="form-control" type="number" value="${nextOrder}" /><div class="form-hint" style="font-size:0.75rem;color:var(--text-tertiary);margin-top:4px;">Lower numbers appear first. Auto-set to next in sequence.</div></div>
    </form>`,
        actions: [
            { label: 'Cancel', class: 'btn-secondary', onClick: closeModal },
            { label: 'Upload', class: 'btn-primary', onClick: (modal) => handleUpload(modal, collectionName) }
        ]
    });
}

async function handleUpload(modal, collectionName) {
    const form = modal.querySelector('#upload-form');
    const fileInput = form.querySelector('input[type="file"]');
    const file = fileInput?.files[0];
    if (!file) { toast.error('Please select a file'); return; }

    // Validate file size (max 1 MB)
    const MAX_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB
    if (file.size > MAX_SIZE_BYTES) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        toast.error(`File is ${sizeMB} MB. Maximum allowed size is 1 MB. Please compress the image and try again.`);
        return;
    }

    const caption = form.querySelector('[name="caption"]')?.value || '';
    const order = parseInt(form.querySelector('[name="order"]')?.value || '0');
    const year = form.querySelector('[name="year"]')?.value || '';

    try {
        toast.info('Uploading...');
        const fileName = `${Date.now()}_${file.name}`;
        const storageRef = ref(storage, `gallery/${fileName}`);
        await uploadBytes(storageRef, file);
        const imageUrl = await getDownloadURL(storageRef);

        const docData = { imageUrl, caption, order, uploadedAt: serverTimestamp() };
        if (collectionName === 'year_photos') docData.year = year;

        await addDoc(collection(db, collectionName), docData);
        await logAction({ action: ACTIONS.UPLOAD, entity: ENTITIES.GALLERY, details: `Uploaded ${collectionName === 'year_photos' ? 'year' : 'gallery'} photo` });
        toast.success('Photo uploaded!');
        closeModal();
        if (collectionName === 'gallery_images') loadGalleryPhotos(); else loadYearPhotos();
    } catch (e) { toast.error('Upload failed: ' + e.message); }
}

function handleDelete(id, collectionName) {
    confirmModal({
        title: 'Delete Photo',
        message: 'Are you sure you want to delete this photo?',
        onConfirm: async () => {
            try {
                const snap = await getDoc(doc(db, collectionName, id));
                if (snap.exists() && snap.data().imageUrl) {
                    try {
                        await deleteObject(ref(storage, snap.data().imageUrl));
                    } catch (storageErr) {
                        console.warn('Storage cleanup failed:', storageErr.message);
                    }
                }
                await deleteDoc(doc(db, collectionName, id));
                await logAction({ action: ACTIONS.DELETE, entity: ENTITIES.GALLERY, entityId: id, details: 'Deleted photo' });
                toast.success('Photo deleted');
                if (collectionName === 'gallery_images') loadGalleryPhotos(); else loadYearPhotos();
            } catch (e) { toast.error('Delete failed: ' + e.message); }
        }
    });
}

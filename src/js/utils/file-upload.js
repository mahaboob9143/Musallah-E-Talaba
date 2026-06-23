// ============================================================
// FILE UPLOAD UTILITY — Firebase Storage Helper
// ============================================================

import { storage } from '../firebase-config.js';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_DOC_TYPES = ['application/pdf', ...ALLOWED_IMAGE_TYPES];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Validate a file before upload
 * @param {File} file
 * @param {Object} options — { maxSize, allowedTypes }
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateFile(file, options = {}) {
    const maxSize = options.maxSize || MAX_FILE_SIZE;
    const allowedTypes = options.allowedTypes || ALLOWED_DOC_TYPES;

    if (!file) return { valid: false, error: 'No file selected' };
    if (file.size > maxSize) return { valid: false, error: `File too large. Max ${Math.round(maxSize / 1024 / 1024)}MB` };
    if (!allowedTypes.includes(file.type)) return { valid: false, error: `Invalid file type. Allowed: ${allowedTypes.map(t => t.split('/')[1]).join(', ')}` };
    return { valid: true };
}

/**
 * Upload file to Firebase Storage with progress callback
 * @param {File} file
 * @param {string} path — Storage path, e.g. 'receipts/filename.jpg'
 * @param {Function} onProgress — (progress: number 0-100) => void
 * @returns {Promise<string>} — Download URL
 */
export function uploadFile(file, path, onProgress = null) {
    return new Promise((resolve, reject) => {
        const storageRef = ref(storage, path);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                if (onProgress) onProgress(progress);
            },
            (error) => reject(error),
            async () => {
                try {
                    const url = await getDownloadURL(uploadTask.snapshot.ref);
                    resolve(url);
                } catch (e) { reject(e); }
            }
        );
    });
}

/**
 * Generate a unique filename with timestamp
 * @param {File} file
 * @returns {string}
 */
export function generateFileName(file) {
    const ext = file.name.split('.').pop();
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
}

/**
 * Create a preview URL for an image file
 * @param {File} file
 * @returns {string} — Object URL (call URL.revokeObjectURL when done)
 */
export function createPreviewURL(file) {
    return URL.createObjectURL(file);
}

export { ALLOWED_IMAGE_TYPES, ALLOWED_DOC_TYPES, MAX_FILE_SIZE };

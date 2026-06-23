// ============================================================
// AUDIT LOGGER — Logs all actions to Firestore audit_logs
// ============================================================

import { db, auth } from '../firebase-config.js';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getCurrentUserRole } from '../auth.js';

/**
 * Logs an action to the audit_logs collection
 */
export async function logAction({ action, entity, entityId, details, changes = null }) {
    try {
        const user = auth.currentUser;
        if (!user) return;

        const logEntry = {
            timestamp: serverTimestamp(),
            userId: user.uid,
            userName: user.displayName || user.email,
            userRole: getCurrentUserRole() || 'unknown',
            action,
            entity,
            entityId: entityId || null,
            details,
            changes: changes || null
        };

        await addDoc(collection(db, 'audit_logs'), logEntry);
    } catch (error) {
        console.error('Audit log error:', error);
    }
}

// Action types
export const ACTIONS = {
    CREATE: 'created',
    UPDATE: 'updated',
    DELETE: 'deleted',
    APPROVE: 'approved',
    REJECT: 'rejected',
    LOGIN: 'login',
    LOGOUT: 'logout',
    UPLOAD: 'uploaded',
    EXPORT: 'exported',
    VERIFY: 'verified'
};

// Entity types
export const ENTITIES = {
    USER: 'user',
    REGISTRATION: 'sehri_registration',
    FEEDBACK: 'feedback',
    DONATION: 'donation',
    TRANSACTION: 'financial_transaction',
    ATTENDANCE: 'attendance',
    CHECKLIST: 'checklist',
    GALLERY: 'gallery',
    SETTINGS: 'settings'
};

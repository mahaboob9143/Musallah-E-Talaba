// ============================================================
// AUTH — Firebase Authentication with role management
// ============================================================

import { auth, db } from './firebase-config.js';
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from './components/notifications.js';
import { logAction, ACTIONS, ENTITIES } from './utils/audit-logger.js';

let currentUserData = null;

/**
 * Login with email and password
 */
export async function login(email, password) {
    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const userData = await getUserData(result.user.uid);

        if (!userData) {
            await signOut(auth);
            throw new Error('User account not found in system. Contact admin.');
        }

        if (userData.status === 'disabled') {
            await signOut(auth);
            throw new Error('Your account has been disabled. Contact admin.');
        }

        currentUserData = userData;

        await logAction({
            action: ACTIONS.LOGIN,
            entity: ENTITIES.USER,
            entityId: result.user.uid,
            details: `${userData.name} logged in`
        });

        return { user: result.user, userData };
    } catch (error) {
        let msg = error.message;
        if (error.code === 'auth/invalid-credential') msg = 'Invalid email or password';
        if (error.code === 'auth/too-many-requests') msg = 'Too many attempts. Try again later.';
        if (error.code === 'auth/user-not-found') msg = 'No account found with this email';
        throw new Error(msg);
    }
}

/**
 * Logout
 */
export async function logout() {
    try {
        await logAction({
            action: ACTIONS.LOGOUT,
            entity: ENTITIES.USER,
            entityId: auth.currentUser?.uid,
            details: `${currentUserData?.name || 'User'} logged out`
        });
        currentUserData = null;
        await signOut(auth);
    } catch (error) {
        console.error('Logout error:', error);
    }
}

/**
 * Sends a password reset email
 */
export async function resetPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        toast.success('Password reset email sent! Check your inbox.');
    } catch (error) {
        throw new Error('Failed to send reset email. Check the email address.');
    }
}

/**
 * Gets user data from Firestore
 */
export async function getUserData(uid) {
    try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) {
            return { id: snap.id, ...snap.data() };
        }
        return null;
    } catch (error) {
        console.error('Error getting user data:', error);
        return null;
    }
}

/**
 * Gets user role array
 */
export async function getUserRole(uid) {
    const userData = await getUserData(uid);
    return userData?.role || [];
}

/**
 * Returns the current user's cached data
 */
export function getCurrentUserData() {
    return currentUserData;
}

/**
 * Listens for auth state changes
 */
export function onAuthChange(callback) {
    return onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserData = await getUserData(user.uid);
        } else {
            currentUserData = null;
        }
        callback(user, currentUserData);
    });
}

/**
 * Returns the current user's role as a comma-separated string
 */
export function getCurrentUserRole() {
    return currentUserData?.role ? currentUserData.role.join(',') : '';
}

/**
 * Checks if user has a specific role
 */
export function hasRole(role) {
    return currentUserData?.role?.includes(role) || false;
}

/**
 * Checks if user is an admin
 */
export function isAdmin() {
    return hasRole('admin');
}

/**
 * Gets the dashboard path based on user role
 */
export function getDashboardPath() {
    if (!currentUserData) return '/login';
    const roles = currentUserData.role || [];
    if (roles.includes('admin')) return '/admin';
    if (roles.includes('financial')) return '/financial';
    if (roles.includes('khidmat')) return '/khidmat';
    return '/';
}

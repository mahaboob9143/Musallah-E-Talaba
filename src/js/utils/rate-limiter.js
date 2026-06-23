// ============================================================
// RATE LIMITER — Client-side rate limiting using localStorage
// ============================================================

const RATE_LIMIT_PREFIX = 'met_rl_';

/**
 * Checks if an action is rate-limited
 * @param {string} key - Identifier for the action (e.g., 'sehri_reg')
 * @param {number} maxAttempts - Max number of attempts allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {{ allowed: boolean, remaining: number, resetTime: number }}
 */
export function checkRateLimit(key, maxAttempts, windowMs) {
    const storageKey = RATE_LIMIT_PREFIX + key;
    const now = Date.now();

    let data = null;
    try {
        data = JSON.parse(localStorage.getItem(storageKey));
    } catch (e) { /* ignore */ }

    if (!data || now > data.resetTime) {
        // Window expired, reset
        data = { attempts: 0, resetTime: now + windowMs };
    }

    const remaining = Math.max(0, maxAttempts - data.attempts);
    const allowed = data.attempts < maxAttempts;

    return { allowed, remaining, resetTime: data.resetTime };
}

/**
 * Records an attempt for rate limiting
 */
export function recordAttempt(key, maxAttempts, windowMs) {
    const storageKey = RATE_LIMIT_PREFIX + key;
    const now = Date.now();

    let data = null;
    try {
        data = JSON.parse(localStorage.getItem(storageKey));
    } catch (e) { /* ignore */ }

    if (!data || now > data.resetTime) {
        data = { attempts: 0, resetTime: now + windowMs };
    }

    data.attempts += 1;

    try {
        localStorage.setItem(storageKey, JSON.stringify(data));
    } catch (e) { /* storage full */ }

    return {
        allowed: data.attempts <= maxAttempts,
        remaining: Math.max(0, maxAttempts - data.attempts),
        resetTime: data.resetTime
    };
}

/**
 * Formats remaining time until rate limit resets
 */
export function formatResetTime(resetTime) {
    const remaining = Math.max(0, resetTime - Date.now());
    const minutes = Math.ceil(remaining / 60000);
    if (minutes <= 1) return 'less than a minute';
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.ceil(minutes / 60);
    return `${hours} hour${hours > 1 ? 's' : ''}`;
}

// Rate limit configurations
export const RATE_LIMITS = {
    SEHRI_REGISTRATION: { key: 'sehri_reg', max: 3, window: 60 * 60 * 1000 },     // 3 per hour
    FEEDBACK: { key: 'feedback', max: 1, window: 24 * 60 * 60 * 1000 },             // 1 per day
    DONATION: { key: 'donation', max: 3, window: 60 * 60 * 1000 }                  // 3 per hour
};

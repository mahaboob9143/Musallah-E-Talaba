// ============================================================
// DATE UTILS — Date formatting, countdown, and helpers
// ============================================================

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Formats a date as "Feb 13, 2026"
 */
export function formatDate(date) {
    const d = new Date(date);
    return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/**
 * Formats a date as "Fri, Feb 13"
 */
export function formatDateShort(date) {
    const d = new Date(date);
    return `${DAYS_SHORT[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/**
 * Formats a date as "2026-02-13"
 */
export function formatDateISO(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Formats a timestamp as "Feb 13, 2026 5:30 PM"
 */
export function formatDateTime(date) {
    const d = new Date(date);
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${formatDate(d)} ${time}`;
}

/**
 * Formats time as "5:21 AM"
 */
export function formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Parses a time string "5:21" to minutes from midnight
 */
export function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

/**
 * Converts minutes from midnight to "Xh Ym" format
 */
export function minutesToDuration(minutes) {
    const h = Math.floor(Math.abs(minutes) / 60);
    const m = Math.abs(minutes) % 60;
    return `${h}h ${m}m`;
}

/**
 * Gets the countdown to a target date
 * @returns {{ days, hours, minutes, seconds, expired }}
 */
export function getCountdown(targetDate) {
    const now = Date.now();
    const target = new Date(targetDate).getTime();
    const diff = target - now;

    if (diff <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    }

    return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
        expired: false
    };
}

/**
 * Returns "X min ago", "X hours ago", etc.
 */
export function timeAgo(date) {
    const now = Date.now();
    const d = new Date(date).getTime();
    const diff = now - d;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return formatDate(date);
}

/**
 * Gets today's date as YYYY-MM-DD
 */
export function getToday() {
    return formatDateISO(new Date());
}

/**
 * Gets the next N dates starting from today
 */
export function getNextDates(n) {
    const dates = [];
    const today = new Date();
    for (let i = 1; i <= n; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        dates.push(d);
    }
    return dates;
}

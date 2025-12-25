/**
 * Cookie storage utilities for persisting settings
 */

const COOKIE_NAME = 'dartsSettings';
const COOKIE_EXPIRY_DAYS = 365;

/**
 * Get settings from cookie
 * @returns {Object|null} Parsed settings object or null if not found
 */
export function getCookie() {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === COOKIE_NAME) {
            try {
                return JSON.parse(decodeURIComponent(value));
            } catch (e) {
                console.error('Failed to parse cookie:', e);
                return null;
            }
        }
    }
    return null;
}

/**
 * Save settings to cookie
 * @param {Object} settings - Settings object to save
 */
export function setCookie(settings) {
    const expires = new Date();
    expires.setTime(expires.getTime() + COOKIE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const value = encodeURIComponent(JSON.stringify(settings));
    document.cookie = `${COOKIE_NAME}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
}

/**
 * Delete settings cookie
 */
export function deleteCookie() {
    document.cookie = `${COOKIE_NAME}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
}


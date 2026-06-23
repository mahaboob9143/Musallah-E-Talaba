// ============================================================
// ROUTER — Hash-based SPA router with role guards
// ============================================================

import { auth } from './firebase-config.js';
import { getUserRole } from './auth.js';
import { escapeHtml } from './utils/validation.js';

const routes = {};
let currentRoute = null;
let currentRouteConfig = null;
let notFoundHandler = null;

/**
 * Registers a route
 * @param {string} path - Route path (e.g., '/', '/admin', '/admin/team')
 * @param {Object} options
 * @param {Function} options.render - Render function that returns HTML or renders to container
 * @param {string[]} [options.roles] - Required roles (empty = public)
 * @param {string} [options.title] - Page title
 */
export function addRoute(path, options) {
    routes[path] = options;
}

/**
 * Navigates to a route
 */
export function navigateTo(path) {
    window.location.hash = path;
}

/**
 * Gets the current route path from hash
 */
export function getCurrentPath() {
    const hash = window.location.hash.slice(1) || '/';
    return hash;
}

/**
 * Sets 404 handler
 */
export function setNotFound(handler) {
    notFoundHandler = handler;
}

/**
 * Resolves and renders the current route
 */
async function resolveRoute() {
    // Wait for Firebase Auth to finish reading its persisted state.
    // This is a Firebase v11 API that resolves once auth state is known
    // (from local storage) — prevents the race condition where auth.currentUser
    // is null on page refresh even when the user is logged in.
    await auth.authStateReady();

    const path = getCurrentPath();
    const container = document.getElementById('page-container');


    // Find matching route
    let route = routes[path];
    let params = {};

    // Try pattern matching for dynamic routes
    if (!route) {
        for (const [pattern, routeConfig] of Object.entries(routes)) {
            const regex = new RegExp('^' + pattern.replace(/:\w+/g, '([^/]+)') + '$');
            const match = path.match(regex);
            if (match) {
                route = routeConfig;
                const paramNames = (pattern.match(/:(\w+)/g) || []).map(p => p.slice(1));
                paramNames.forEach((name, i) => { params[name] = match[i + 1]; });
                break;
            }
        }
    }

    if (!route) {
        if (notFoundHandler) {
            notFoundHandler(container);
        } else {
            container.innerHTML = `
        <div class="empty-state" style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div class="empty-icon">🔍</div>
          <div class="empty-title">Page Not Found</div>
          <div class="empty-desc">The page you're looking for doesn't exist.</div>
          <a href="#/" class="btn btn-primary" style="margin-top:1rem;">Go Home</a>
        </div>`;
        }
        return;
    }

    // Check role-based access
    if (route.roles && route.roles.length > 0) {
        const user = auth.currentUser;
        if (!user) {
            navigateTo('/login');
            return;
        }

        const userRole = await getUserRole(user.uid);
        const hasAccess = route.roles.some(r => userRole.includes(r));

        if (!hasAccess) {
            container.innerHTML = `
        <div class="empty-state" style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div class="empty-icon">🔒</div>
          <div class="empty-title">Access Denied</div>
          <div class="empty-desc">You don't have permission to view this page.</div>
          <a href="#/" class="btn btn-primary" style="margin-top:1rem;">Go Home</a>
        </div>`;
            return;
        }
    }

    // Update page title
    if (route.title) {
        document.title = `${route.title} | Musallah-E-Talaba`;
    }

    // Render the route
    try {
        // Call onLeave for previous route before rendering new one
        if (currentRouteConfig?.onLeave) {
            currentRouteConfig.onLeave();
        }
        currentRoute = path;
        currentRouteConfig = route;
        if (typeof route.render === 'function') {
            await route.render(container, params);
        }
    } catch (error) {
        console.error('Route render error:', error);
        container.innerHTML = `
      <div class="empty-state" style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Something went wrong</div>
        <div class="empty-desc">${escapeHtml(error.message)}</div>
        <a href="#/" class="btn btn-primary" style="margin-top:1rem;">Go Home</a>
      </div>`;
    }
}

/**
 * Initializes the router
 */
export function initRouter() {
    window.addEventListener('hashchange', resolveRoute);
    resolveRoute();
}

/**
 * Returns current route name
 */
export function getCurrentRoute() {
    return currentRoute;
}

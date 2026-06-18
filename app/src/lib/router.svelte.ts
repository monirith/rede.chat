// Minimal HTML5-history router. No deps, no hash, just clean URLs.
//
// Usage:
//   - Read `router.path` reactively inside templates / $derived
//   - Call `push("/credits")` to navigate programmatically
//   - Internal <a href="/..."> links are intercepted globally by initRouter()
//
// SPA fallback: configure Cloudflare Pages with `public/_redirects` →
//   `/* /index.html 200` so every path serves the same SPA shell.

// /lang/<code>/ prefix is an SEO entry point. Strip it before exposing the
// path to the rest of the SPA so route matching stays oblivious — i18n.ts
// reads the prefix separately to set the UI language.
function normalizePath(p: string): string {
  return p.replace(/^\/lang\/[^/]+\/?/, "/");
}

class RouterState {
  path = $state(typeof location !== "undefined" ? normalizePath(location.pathname) : "/");
  query = $state(typeof location !== "undefined" ? location.search : "");
}

export const router = new RouterState();

export function push(path: string, replace = false) {
  const url = new URL(path, location.origin);
  const same = url.pathname === location.pathname && url.search === location.search;
  if (!same) {
    if (replace) history.replaceState({}, "", url.pathname + url.search);
    else history.pushState({}, "", url.pathname + url.search);
  }
  router.path = url.pathname;
  router.query = url.search;
  // Most page transitions should reset scroll
  if (!replace) window.scrollTo(0, 0);
}

export function replace(path: string) {
  push(path, true);
}

export function initRouter() {
  if (typeof window === "undefined") return;

  window.addEventListener("popstate", () => {
    router.path = normalizePath(location.pathname);
    router.query = location.search;
  });

  // Intercept clicks on internal <a> tags so they navigate via history.pushState
  // instead of full page reloads.
  window.addEventListener("click", (e) => {
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const a = (e.target as HTMLElement | null)?.closest("a");
    if (!a) return;
    const href = a.getAttribute("href");
    if (!href) return;
    if (a.target && a.target !== "_self") return;
    // External or special schemes
    if (/^[a-z]+:/i.test(href) && !href.startsWith(location.origin)) return;
    if (href.startsWith("mailto:") || href.startsWith("tel:")) return;
    // Pure hash on current page — let the browser handle
    if (href.startsWith("#")) return;

    e.preventDefault();
    // Normalize same-origin absolute URLs to pathname
    const url = new URL(href, location.origin);
    push(url.pathname + url.search);
  });
}

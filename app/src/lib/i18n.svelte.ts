// Reactive i18n store. Uses Svelte 5 runes — must be a .svelte.ts file.
//
// - On first load, reads localStorage; falls back to browser language.
// - The chosen language code is exposed reactively via `lang.code`.
// - `t(key)` returns the translated string for the current language.
// - Components import `lang` and `t` directly; reading `lang.code` in a
//   reactive context (template, $derived, $effect) auto-tracks changes.

import { detectBrowserLanguage, ALL_LANGUAGES, DEFAULT_LANGUAGES, type LanguageInfo } from "./languages";
import { getTranslation, type TranslationKey } from "./translations";

const STORAGE_KEY = "rede:lang";

// /lang/<code>/ URLs are SEO entry points: each is prerendered with its own
// <html lang>, <title>, hreflang, and JSON-LD. When a user lands on one,
// honour the code over any stored preference so they see the language
// promised by the URL (and Google's snippet). After applying, swap the URL
// for "/" so the user gets a clean address bar going forward.
function langFromUrl(): string | null {
  if (typeof location === "undefined") return null;
  const m = location.pathname.match(/^\/lang\/([a-z]{2,3}(?:-[A-Za-z]{2,4})?)\/?(.*)$/i);
  if (!m) return null;
  return m[1];
}

function initial(): string {
  const fromUrl = langFromUrl();
  if (fromUrl) {
    // Strip the /lang/<code> prefix; the SPA renders the same routes
    // regardless of how the user got here.
    try {
      const rest = location.pathname.replace(/^\/lang\/[^/]+\/?/, "/") + location.search;
      history.replaceState({}, "", rest);
    } catch { /* SSR / no-op */ }
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, fromUrl);
    return fromUrl;
  }
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  }
  return detectBrowserLanguage();
}

class LangState {
  code = $state<string>(initial());
}

export const lang = new LangState();

export function setLanguage(code: string) {
  lang.code = code;
  if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, code);
  if (typeof document !== "undefined") document.documentElement.lang = code;
}

export function t(key: TranslationKey): string {
  return getTranslation(lang.code)[key] ?? key;
}

// Order shown in the picker dropdown:
//   1. Browser-detected language (could be outside DEFAULT_LANGUAGES)
//   2. Swiss German
//   3. Rumantsch Grischun
//   4. Remaining DEFAULT_LANGUAGES in declared order
//
// Computed once at module load — never changes during a session.
export function pickerLanguages(): LanguageInfo[] {
  const browserCode = detectBrowserLanguage();
  const ordered: LanguageInfo[] = [];
  const seen = new Set<string>();

  const push = (code: string) => {
    if (seen.has(code)) return;
    const lang = ALL_LANGUAGES.find((l) => l.code === code);
    if (!lang) return;
    ordered.push(lang);
    seen.add(code);
  };

  push(browserCode);
  push("gsw");
  push("rm");
  for (const l of DEFAULT_LANGUAGES) push(l.code);

  return ordered;
}

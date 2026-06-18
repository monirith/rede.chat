// Static prerender pass, runs after `vite build`. Produces:
//   - dist/<dialect>/index.html  for each Swiss dialect (9 of them)
//   - dist/lang/<code>/index.html for each supported UI language (56 of them)
//
// Both classes of pages share the same SPA bundle and just differ in
// <title>, <meta description>, canonical, OG tags, JSON-LD, <html lang>, and
// a noscript block. That gives Googlebot substantive HTML before JS runs and
// signals which audience each URL targets.
//
// The Swiss-dialect pages target "learners of Mundart X" (content/Course
// schema). The /lang/<code>/ pages target "speakers of language X who want to
// learn Swiss German" (UI-translated landing + hreflang grouping).

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Node 24 supports direct .ts imports, no transpile step needed.
const { DIALECTS } = await import("../src/lib/catalog.ts");
const { ALL_LANGUAGES } = await import("../src/lib/languages.ts");
const { TRANSLATIONS } = await import("../src/lib/translations.ts");

const here = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(here, "../dist");

// Codes we ship UI translations for. Used in hreflang + sitemap. Aliases
// from the TRANSLATIONS map (fil, zh-Hant) are skipped from SEO surfaces.
const SUPPORTED_CODES = ALL_LANGUAGES.map((l) => l.code);

// BCP-47 mapping where ISO 639 alone is ambiguous. Most codes pass through
// unchanged. `gsw` is BCP-47 valid for Swiss German.
const HTML_LANG = {
  gsw: "gsw-CH", rm: "rm-CH", zh: "zh-Hans", yue: "yue-Hant",
  wuu: "wuu", arz: "arz", pcm: "pcm", pnb: "pnb",
};

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function tFor(code) {
  return TRANSLATIONS[code] ?? TRANSLATIONS.en;
}

// ---------- dialect pages ----------

function dialectTitle(d) {
  return `Learn ${d.name} online · AI conversation practice · rede.chat`;
}
function dialectDescription(d) {
  return `Practice ${d.name}, spoken in ${d.region}, with an AI conversation partner. Real-time pronunciation coaching, instant corrections, pay-as-you-go.`;
}
function dialectSeoBody(d) {
  const others = DIALECTS.filter((x) => x.key !== d.key);
  // Real visible HTML (not noscript) so Googlebot's first-pass crawl sees H1
  // and crawlable links without JS. Svelte clears #app before mount, so this
  // disappears in normal browsers the moment the SPA hydrates.
  return `
      <main style="max-width:64rem;margin:0 auto;padding:2rem 1.5rem;font-family:'Inter',system-ui,sans-serif;color:#0a0a0a;">
        <h1 style="font-size:2.25rem;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 1rem;">Learn ${escapeHtml(d.name)} with AI</h1>
        <p style="font-size:1.125rem;line-height:1.6;opacity:0.7;max-width:36rem;margin:0 0 2rem;">${escapeHtml(d.name)} is spoken in ${escapeHtml(d.region)}. On rede.chat you practice it in real spoken conversation with an AI partner that catches mistakes, coaches pronunciation, and adapts to your level.</p>
        <h2 style="font-size:1.5rem;font-weight:700;margin:2rem 0 1rem;">How it works</h2>
        <ol style="line-height:1.6;opacity:0.8;">
          <li>Pick ${escapeHtml(d.name)} as your conversation dialect.</li>
          <li>Pick a situation: supermarket checkout, tram, office, doctor, neighbour, or free talk.</li>
          <li>Speak with the AI partner. It corrects mistakes and explains in context.</li>
        </ol>
        <p style="margin:1.5rem 0;"><a href="/app" style="color:#0a0a0a;font-weight:600;">Start practising ${escapeHtml(d.name)} now</a></p>
        <h2 style="font-size:1.5rem;font-weight:700;margin:2rem 0 1rem;">Other Swiss languages and dialects on rede.chat</h2>
        <ul style="list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:0.5rem;">
          ${others.map((o) => `<li><a href="/${o.key}/" style="color:#0a0a0a;">${escapeHtml(o.name)}</a> <em style="opacity:0.6;">(${escapeHtml(o.region)})</em></li>`).join("\n          ")}
        </ul>
      </main>`;
}
function dialectJsonLd(d) {
  const inLang = d.key === "francais" ? "fr-CH"
    : d.key === "italiano" ? "it-CH"
    : d.key === "rumantsch" ? "rm-CH"
    : d.key === "hochdeutsch" ? "de-CH"
    : "gsw";
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Course",
    name: `${d.name} conversation practice`,
    description: dialectDescription(d),
    provider: { "@type": "Organization", name: "rede.chat", sameAs: "https://rede.chat/" },
    educationalLevel: "Beginner to advanced",
    inLanguage: inLang,
    teaches: d.name,
    url: `https://rede.chat/${d.key}/`,
    offers: { "@type": "Offer", priceCurrency: "CHF", price: "2.99",
      priceValidUntil: "2027-12-31", availability: "https://schema.org/InStock",
      description: "Pay-as-you-go credit packs from CHF 2.99." },
  }, null, 2);
}

// ---------- locale (lang) pages ----------

function localeTitle(code) {
  const d = tFor(code);
  // Pattern: "<hero> · rede.chat" — short and language-native.
  const hero = d["landing.hero"] ?? "Learn Swiss German with AI";
  return `${hero} · rede.chat`;
}
function localeDescription(code) {
  return tFor(code)["landing.subhero"] ?? "AI conversation partner in 9 Swiss dialects. Real-time corrections and pronunciation coaching.";
}
function localeSeoBody(code) {
  const d = tFor(code);
  const hero = d["landing.hero"] ?? "Learn Swiss German with AI";
  const sub = d["landing.subhero"] ?? "AI conversation partner.";
  const ctaStart = d["landing.ctaStart"] ?? "Start chatting";
  const dialectsTitle = d["landing.dialectsTitle"] ?? "Dialects";
  const langInfo = ALL_LANGUAGES.find((l) => l.code === code);
  const nativeName = langInfo?.name ?? code;
  // Real visible HTML (not noscript). See dialectSeoBody for rationale.
  return `
      <main style="max-width:64rem;margin:0 auto;padding:2rem 1.5rem;font-family:'Inter',system-ui,sans-serif;color:#0a0a0a;">
        <h1 style="font-size:2.25rem;font-weight:800;letter-spacing:-0.02em;line-height:1.1;margin:0 0 1rem;">${escapeHtml(hero)}</h1>
        <p style="font-size:1.125rem;line-height:1.6;opacity:0.7;max-width:36rem;margin:0 0 2rem;">${escapeHtml(sub)}</p>
        <h2 style="font-size:1.5rem;font-weight:700;margin:2rem 0 1rem;">${escapeHtml(dialectsTitle)}</h2>
        <ul style="list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:0.5rem;">
          ${DIALECTS.map((dl) => `<li><a href="/${dl.key}/" style="color:#0a0a0a;">${escapeHtml(dl.name)}</a> <em style="opacity:0.6;">(${escapeHtml(dl.region)})</em></li>`).join("\n          ")}
        </ul>
        <p style="margin:1.5rem 0;"><a href="/app" style="color:#0a0a0a;font-weight:600;">${escapeHtml(ctaStart)}</a></p>
        <p lang="en" style="margin-top:2rem;"><small style="opacity:0.5;">This page is also available in: ${nativeName}.</small></p>
      </main>`;
}
function localeJsonLd(code) {
  const d = tFor(code);
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "rede.chat",
    url: `https://rede.chat/lang/${code}/`,
    description: d["landing.subhero"] ?? "AI conversation partner for Swiss German.",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web Browser, iOS, Android",
    inLanguage: SUPPORTED_CODES,
    availableLanguage: SUPPORTED_CODES,
    offers: { "@type": "Offer", priceCurrency: "CHF", price: "2.99",
      priceValidUntil: "2027-12-31", availability: "https://schema.org/InStock",
      description: "Pay-as-you-go credit packs from CHF 2.99. No subscription." },
  }, null, 2);
}

// hreflang block: one alternate per supported language code, plus x-default.
// Same block is reused for every locale page (each one self-includes itself).
function hreflangBlock() {
  const lines = SUPPORTED_CODES.map((c) => {
    const htmlLang = HTML_LANG[c] ?? c;
    return `    <link rel="alternate" hreflang="${htmlLang}" href="https://rede.chat/lang/${c}/" />`;
  });
  lines.push(`    <link rel="alternate" hreflang="x-default" href="https://rede.chat/" />`);
  return lines.join("\n");
}

// ---------- shared template munging ----------

// Map our internal locale code to a BCP-47 og:locale value (underscore form,
// the OpenGraph convention). Falls back to the code itself.
function ogLocaleFor(htmlLang) {
  return htmlLang.replace("-", "_");
}

function patch(html, { title, desc, url, htmlLang, jsonLd, seoBody, extraHead = "" }) {
  let out = html;
  // <html lang="...">
  out = out.replace(/<html[^>]*>/, `<html lang="${htmlLang}">`);
  // <title>, description, canonical
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
  out = out.replace(/<meta name="description" content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${escapeHtml(desc)}" />`);
  out = out.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/,
    `<link rel="canonical" href="${url}" />`);
  // OG / Twitter
  out = out.replace(/<meta property="og:url" content="[^"]*"\s*\/?>/,
    `<meta property="og:url" content="${url}" />`);
  out = out.replace(/<meta property="og:title" content="[^"]*"\s*\/?>/,
    `<meta property="og:title" content="${escapeHtml(title)}" />`);
  out = out.replace(/<meta property="og:description" content="[^"]*"\s*\/?>/,
    `<meta property="og:description" content="${escapeHtml(desc)}" />`);
  out = out.replace(/<meta property="og:locale" content="[^"]*"\s*\/?>/,
    `<meta property="og:locale" content="${ogLocaleFor(htmlLang)}" />`);
  out = out.replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`);
  out = out.replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/,
    `<meta name="twitter:description" content="${escapeHtml(desc)}" />`);
  // Strip the placeholder hreflang block from the base template so we can
  // emit a full one (we replace 4 stale lines with N+1 fresh ones).
  out = out.replace(/<!-- hreflang alternates:[\s\S]*?-->/, "");
  out = out.replace(/(\s*<link rel="alternate" hreflang="[^"]+" href="[^"]*"\s*\/?>)+/g, "");
  // Inject the fresh hreflang block + Course/SoftwareApp JSON-LD right before </head>
  const headInject = `\n${hreflangBlock()}\n    <script type="application/ld+json">${jsonLd}</script>\n${extraHead}\n  </head>`;
  out = out.replace("</head>", headInject);
  // Replace the visible-HTML SEO fallback inside #app with the locale or
  // dialect-specific version. Svelte clears #app on mount, so this content
  // only shows on Googlebot's first-pass crawl and to no-JS clients.
  out = out.replace(/<div id="app">[\s\S]*?<\/div>/, `<div id="app">${seoBody}</div>`);
  return out;
}

// ---------- run ----------

const baseHtml = await readFile(resolve(distDir, "index.html"), "utf8");

let dialectCount = 0;
for (const d of DIALECTS) {
  // Trailing slash: Cloudflare Pages serves the prerendered file at /<key>/
  // and 308-redirects /<key> → /<key>/. Canonical/og:url/sitemap must point at
  // the final form to avoid sending Google through a redirect hop.
  const url = `https://rede.chat/${d.key}/`;
  const htmlLang = d.key === "francais" ? "fr-CH"
    : d.key === "italiano" ? "it-CH"
    : d.key === "rumantsch" ? "rm-CH"
    : d.key === "hochdeutsch" ? "de-CH"
    : "gsw-CH";
  const html = patch(baseHtml, {
    title: dialectTitle(d),
    desc: dialectDescription(d),
    url, htmlLang,
    jsonLd: dialectJsonLd(d),
    seoBody: dialectSeoBody(d),
  });
  const outDir = resolve(distDir, d.key);
  await mkdir(outDir, { recursive: true });
  await writeFile(resolve(outDir, "index.html"), html);
  dialectCount++;
}

let localeCount = 0;
for (const code of SUPPORTED_CODES) {
  const url = `https://rede.chat/lang/${code}/`;
  const htmlLang = HTML_LANG[code] ?? code;
  const html = patch(baseHtml, {
    title: localeTitle(code),
    desc: localeDescription(code),
    url, htmlLang,
    jsonLd: localeJsonLd(code),
    seoBody: localeSeoBody(code),
  });
  const outDir = resolve(distDir, "lang", code);
  await mkdir(outDir, { recursive: true });
  await writeFile(resolve(outDir, "index.html"), html);
  localeCount++;
}

console.log(`[prerender] wrote ${dialectCount} dialect pages and ${localeCount} locale pages`);

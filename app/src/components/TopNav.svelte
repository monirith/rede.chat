<script lang="ts">
  import { getSession } from "../lib/auth";
  import { t } from "../lib/i18n.svelte";
  import { push } from "../lib/router.svelte";
  import LanguagePicker from "./LanguagePicker.svelte";
  import Wordmark from "./Wordmark.svelte";
  import SignIn from "../pages/SignIn.svelte";

  let { current = "" } = $props();

  let signedIn = $state(false);
  let showSignIn = $state(false);
  let menuOpen = $state(false);
  $effect(() => { signedIn = !!getSession(); });

  let links = $derived([
    { href: "/app", label: t("nav.practice"), key: "app", always: true },
    { href: "/history", label: t("nav.history"), key: "history", always: true },
    { href: "/phrasebook", label: t("nav.phrasebook"), key: "phrasebook", always: true },
    { href: "/credits", label: t("nav.credits"), key: "credits", always: true },
    { href: "/profile", label: t("nav.profile"), key: "profile", always: false },
  ]);

  let visibleLinks = $derived(links.filter((l) => l.always || signedIn));
</script>

<nav class="bg-cream/80 backdrop-blur sticky top-0 z-10">
  <div class="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
    <Wordmark size="lg" />

    <!-- Desktop nav (≥ md) -->
    <div class="hidden sm:flex items-center gap-1 text-sm">
      {#each visibleLinks as l}
        <a
          href={l.href}
          class="px-2 py-1 rounded {current === l.key ? 'bg-ink text-cream' : 'text-ink/70 hover:text-ink'}"
        >
          {l.label}
        </a>
      {/each}
      {#if !signedIn}
        <button
          onclick={() => showSignIn = true}
          class="px-2 py-1 rounded text-ink/70 hover:text-ink"
        >{t("nav.signIn")}</button>
      {/if}
      <div class="ml-2 hidden md:block"><LanguagePicker /></div>
    </div>

    <!-- Mobile hamburger (< md). Language stays auto-detected from browser. -->
    <button
      class="sm:hidden w-10 h-10 flex items-center justify-center border border-ink/20 rounded-md"
      aria-label="Open menu"
      onclick={() => menuOpen = !menuOpen}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    </button>
  </div>
</nav>

<!-- Mobile menu overlay -->
{#if menuOpen}
  <div
    class="sm:hidden fixed inset-0 z-40 bg-ink/60 backdrop-blur-md"
    onclick={() => menuOpen = false}
    role="dialog"
    aria-modal="true"
  >
    <div
      class="absolute top-16 right-4 bg-cream rounded-xl shadow-xl py-3 min-w-[240px]"
      onclick={(e) => e.stopPropagation()}
    >
      {#each visibleLinks as l}
        <a
          href={l.href}
          onclick={(e) => { e.preventDefault(); menuOpen = false; push(l.href); }}
          class="block px-6 py-3.5 text-lg {current === l.key ? 'font-semibold text-ink' : 'text-ink/70 hover:text-ink'}"
        >
          {l.label}
        </a>
      {/each}
      {#if !signedIn}
        <button
          onclick={() => { menuOpen = false; showSignIn = true; }}
          class="block w-full text-left px-6 py-3.5 text-lg text-ink/70 hover:text-ink"
        >{t("nav.signIn")}</button>
      {/if}
    </div>
  </div>
{/if}

{#if showSignIn}
  <div
    class="fixed inset-0 z-50 bg-ink/60 backdrop-blur-md flex items-center justify-center px-6"
    onclick={(e) => { if (e.target === e.currentTarget) showSignIn = false; }}
    role="dialog"
    aria-modal="true"
  >
    <div class="bg-cream rounded-2xl p-8 w-full max-w-sm shadow-xl" onclick={(e) => e.stopPropagation()}>
      <SignIn onclose={() => showSignIn = false} />
    </div>
  </div>
{/if}

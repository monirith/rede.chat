<script lang="ts">
  import { signInWithEmail, verifyEmailOtp, signInWithOAuth, type OAuthProvider } from "../lib/auth";
  import { config } from "../lib/config";
  import { t } from "../lib/i18n.svelte";

  const showGoogle = config.oauthProviders.includes("google");
  const showApple = config.oauthProviders.includes("apple");

  let { onclose }: { onclose?: () => void } = $props();

  let email = $state("");
  let code = $state("");
  let sending = $state(false);
  let verifying = $state(false);
  let sent = $state(false);
  let error = $state<string | null>(null);
  let oauthing = $state<OAuthProvider | null>(null);

  async function submit(e: Event) {
    e.preventDefault();
    if (!email) return;
    sending = true;
    error = await signInWithEmail(email);
    sending = false;
    if (!error) sent = true;
  }

  async function verify(e: Event) {
    e.preventDefault();
    if (!code) return;
    verifying = true;
    error = await verifyEmailOtp(email, code.trim());
    verifying = false;
    if (!error) onclose?.();
  }

  async function oauth(provider: OAuthProvider) {
    oauthing = provider;
    error = await signInWithOAuth(provider);
    if (error) oauthing = null;
  }
</script>

<h2 class="font-display font-bold text-3xl">{t("signin.title")}</h2>

{#if sent}
  <div class="mt-8 card">
    <div class="font-semibold">{t("signin.sentTitle")}</div>
    <div class="text-sm text-ink/60 mt-1">{t("signin.sentBody")}</div>
    <form onsubmit={verify} class="mt-4 space-y-3">
      <input
        type="text"
        inputmode="numeric"
        autocomplete="one-time-code"
        bind:value={code}
        placeholder="••••••"
        maxlength="6"
        class="w-full px-4 py-3 rounded-lg border border-ink/15 focus:outline-none focus:border-ink text-center tracking-[0.5em] text-lg"
        required
      />
      <button type="submit" class="btn-primary w-full py-3" disabled={verifying}>
        {verifying ? "..." : t("nav.continue")}
      </button>
    </form>
    {#if error}<div class="mt-3 text-red-swiss text-sm">{error}</div>{/if}
  </div>
{:else}
  <div class="mt-8 space-y-2">
    {#if showGoogle}
    <button
      type="button"
      onclick={() => oauth("google")}
      disabled={oauthing !== null}
      class="w-full py-3 px-4 rounded-lg border border-ink/15 bg-white hover:border-ink/30 transition flex items-center justify-center gap-3 font-medium disabled:opacity-50"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.61z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z"/>
        <path fill="#FBBC05" d="M3.97 10.71A5.41 5.41 0 0 1 3.68 9c0-.59.1-1.17.29-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.01-2.33z"/>
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.96L3.97 7.3C4.68 5.16 6.66 3.58 9 3.58z"/>
      </svg>
      <span>{oauthing === "google" ? "…" : "Continue with Google"}</span>
    </button>
    {/if}

    {#if showApple}
    <button
      type="button"
      onclick={() => oauth("apple")}
      disabled={oauthing !== null}
      class="w-full py-3 px-4 rounded-lg bg-ink text-cream hover:bg-ink/90 transition flex items-center justify-center gap-3 font-medium disabled:opacity-50"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
        <path d="M14.46 9.55c.02 2.24 1.96 2.99 1.98 3a8.31 8.31 0 0 1-1.04 2.17c-.62.91-1.26 1.82-2.27 1.84-1 .02-1.32-.6-2.46-.6-1.14 0-1.5.58-2.44.62-.98.04-1.73-.99-2.36-1.9-1.27-1.85-2.25-5.23-.94-7.5a3.66 3.66 0 0 1 3.1-1.9c.96-.02 1.87.65 2.46.65.58 0 1.69-.8 2.85-.69.49.02 1.85.2 2.73 1.49a3.58 3.58 0 0 0-1.62 3.02zM12.7 3.14a3.4 3.4 0 0 0 .83-2.47 3.6 3.6 0 0 0-2.36 1.22 3.32 3.32 0 0 0-.85 2.4c1 .07 2.01-.49 2.38-1.15z"/>
      </svg>
      <span>{oauthing === "apple" ? "…" : "Continue with Apple"}</span>
    </button>
    {/if}
  </div>

  {#if showGoogle || showApple}
  <div class="flex items-center gap-3 my-6 text-xs text-ink/40">
    <div class="flex-1 h-px bg-ink/10"></div>
    <span>{t("home.or")}</span>
    <div class="flex-1 h-px bg-ink/10"></div>
  </div>
  {/if}

  <p class="text-sm text-ink/60 mb-3">{t("signin.subtitle")}</p>

  <form onsubmit={submit} class="space-y-3">
    <input
      type="email"
      bind:value={email}
      placeholder={t("signin.emailPlaceholder")}
      class="w-full px-4 py-3 rounded-lg border border-ink/15 focus:outline-none focus:border-ink"
      required
    />
    <button type="submit" class="btn-primary w-full py-3" disabled={sending || oauthing !== null}>
      {sending ? "..." : t("signin.send")}
    </button>
  </form>
  {#if error}<div class="mt-3 text-red-swiss text-sm">{error}</div>{/if}
{/if}

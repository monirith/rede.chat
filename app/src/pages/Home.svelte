<script lang="ts">
  import { onMount } from "svelte";
  import { push } from "../lib/router.svelte";
  import { getSession } from "../lib/auth";
  import { api, type UserInfo } from "../lib/api";
  import { DIALECTS, SCENARIOS, scenarioNameFor } from "../lib/catalog";
  import DialectCard from "../components/DialectCard.svelte";
  import NewsPanel from "../components/NewsPanel.svelte";
  import TopNav from "../components/TopNav.svelte";
  import SignIn from "./SignIn.svelte";
  import { formatBalance } from "../lib/format";
  import { t } from "../lib/i18n.svelte";

  const DIALECT_KEY = "rede:dialect";
  const SCENARIO_KEY = "rede:scenario";

  let user = $state<UserInfo | null>(null);
  let signedIn = $state(false);
  let loading = $state(true);

  // Default scenario is always "free_talk" on fresh start. We validate the
  // stored value against the scenario catalog so a stale or "news" key (which
  // requires a selected article and doesn't make sense as a default) falls
  // back to free_talk.
  const _validScenarios = new Set(SCENARIOS.map((s) => s.key));
  const _storedScenario = localStorage.getItem(SCENARIO_KEY);
  let selectedDialect = $state(localStorage.getItem(DIALECT_KEY) ?? "zuri");
  let selectedScenario = $state(
    _storedScenario && _validScenarios.has(_storedScenario) ? _storedScenario : "free_talk"
  );

  let showDialectModal = $state(false);
  let showScenarioModal = $state(false);
  let showNewsModal = $state(false);
  let showSignIn = $state(false);
  let selectedArticle = $state<{ title: string; title1: string; title2: string; body: string; image?: string } | null>(null);

  const dialects = DIALECTS;
  const scenarios = SCENARIOS;

  $effect(() => {
    if (selectedScenario !== "news") selectedArticle = null;
  });

  onMount(async () => {
    signedIn = !!getSession();
    // Anonymous and signed-in are separate identities, each fetches its own
    // user row (device-user when anon, JWT-user when signed in).
    try {
      const m = await api.me();
      user = m.user;
    } catch {
      user = {
        id: "local", email: null, name: null, seconds: 0,
        current_streak: 0, longest_streak: 0,
        last_session_date: null, created_at: "",
      } as any;
    }
    loading = false;
  });

  function pickDialect(key: string) {
    selectedDialect = key;
    localStorage.setItem(DIALECT_KEY, key);
    showDialectModal = false;
  }

  function pickScenario(key: string) {
    if (key === "news") {
      showScenarioModal = false;
      showNewsModal = true;
      return;
    }
    selectedScenario = key;
    localStorage.setItem(SCENARIO_KEY, key);
    showScenarioModal = false;
  }

  function pickArticle(article: { title: string; title1: string; title2: string; body: string; image?: string }) {
    selectedArticle = article;
    selectedScenario = "news";
    localStorage.setItem(SCENARIO_KEY, "news");
    showNewsModal = false;
  }

  function startSession() {
    const scenario = selectedScenario === "news" ? "free_talk" : selectedScenario;
    sessionStorage.setItem("rede:next", JSON.stringify({
      dialect: selectedDialect,
      scenario,
      ...(selectedArticle ? { newsContext: selectedArticle } : {}),
    }));
    push("/session");
  }

  let currentDialect = $derived(dialects.find((d) => d.key === selectedDialect) ?? dialects[0]);
  let currentScenario = $derived(scenarios.find((s) => s.key === selectedScenario));
  let displayName = $derived.by(() => {
    if (user?.name) return user.name;
    const email = user?.email;
    // Apple "Hide My Email" relay addresses aren't human-friendly; don't use
    // them as a name. Greet without a name instead.
    if (!email || email.endsWith("@privaterelay.appleid.com")) return null;
    const local = email.split("@")[0];
    return local.includes(".") ? local.split(".")[0] : local;
  });

  let canStart = $derived(
    (selectedScenario !== "news" || !!selectedArticle) && (user?.seconds ?? 0) > 0
  );
</script>

<TopNav current="app" />

<main class="max-w-4xl mx-auto px-6 pt-4 pb-10 sm:pt-28 sm:pb-20">
  {#if loading}
    <div class="text-ink/40">…</div>
  {:else if user}

    <!-- Hero / greeting -->
    {#if signedIn && user.email}
      <div class="flex items-center justify-between mb-6 sm:mb-14">
        <a href="/profile" class="font-display font-extrabold text-4xl sm:text-6xl tracking-tight leading-tight hover:opacity-70 transition-opacity">
          {t("home.hello")}{displayName ? `, ${displayName}` : ""}
        </a>
        <div class="text-right">
          <div class="text-2xl leading-none">{user.current_streak > 1 ? '🔥 ' : ''}{user.current_streak}</div>
          <div class="text-xs text-ink/50 mt-0.5">{t("home.dayStreak")}</div>
          <a href="/credits" class="text-sm text-ink/70 hover:text-ink block mt-2">
            {formatBalance(user.seconds, t("unit.minutes"), t("unit.seconds"))} {t("home.creditsLeft")}
          </a>
        </div>
      </div>
    {:else}
      <div class="mb-6 sm:mb-14 sm:pt-4">
        <h1 class="font-display font-extrabold text-4xl sm:text-6xl tracking-tight leading-tight">
          {t("landing.hero")}
        </h1>
        <p class="mt-3 sm:mt-6 text-base sm:text-xl text-ink/70 max-w-xl leading-relaxed">
          {t("landing.subhero")}
        </p>
      </div>
    {/if}

    <!-- Dialect + Situation pickers: stacked on small, side-by-side from sm up. -->
    <div class="flex flex-col sm:flex-row gap-4 mb-6 items-stretch">
      <div class="flex-1 flex flex-col">
        <div class="text-xs font-semibold uppercase tracking-widest text-ink/40 mb-2">{t("home.dialect")}</div>
        <div class="h-[100px] flex">
          <DialectCard dialect={currentDialect} selected={true} onclick={() => showDialectModal = true} />
        </div>
      </div>
      <div class="flex-1 flex flex-col">
        <div class="text-xs font-semibold uppercase tracking-widest text-ink/40 mb-2">{t("home.situation")}</div>
        <div class="h-[100px] flex">
        {#if selectedScenario === "news"}
          <button onclick={() => showScenarioModal = true} class="card relative overflow-hidden w-full h-full text-left transition-all duration-150 hover:-translate-y-1 hover:shadow-md">
            <img src={selectedArticle?.image ?? "/situations/news.jpg"} alt="" class="absolute right-0 top-0 h-full w-1/2 object-cover pointer-events-none" />
            <div class="absolute inset-0 bg-[linear-gradient(to_right,white_50%,transparent_60%)] pointer-events-none"></div>
            <div class="relative">
              {#if selectedArticle}
                <div class="font-semibold text-sm text-outline-white line-clamp-2">{selectedArticle.title1}</div>
                {#if selectedArticle.title2}
                  <div class="text-xs text-ink/50 mt-0.5 line-clamp-1 text-outline-white">{selectedArticle.title2}</div>
                {/if}
              {:else}
                <!-- Title = target language (the dialect to learn).
                     Subtitle = user UI language. Don't swap. -->
                <div class="font-semibold text-sm">{scenarioNameFor(selectedDialect, "news", "Aktuelli Nüüs")}</div>
                <div class="text-xs text-ink/50 mt-0.5">{t("home.newsSubtitle")}</div>
              {/if}
            </div>
          </button>
        {:else}
          {@const s = currentScenario}
          <button onclick={() => showScenarioModal = true} class="card relative overflow-hidden w-full h-full text-left transition-all duration-150 hover:-translate-y-1 hover:shadow-md">
            {#if s?.image}
              <img src={s.image} alt="" class="absolute right-0 top-0 h-full w-1/2 object-cover pointer-events-none" />
              <div class="absolute inset-0 bg-[linear-gradient(to_right,white_50%,transparent_60%)] pointer-events-none"></div>
            {/if}
            <div class="relative">
              <!-- Title = target language (the dialect to learn).
                   Subtitle = user UI language. Don't swap. -->
              <div class="font-semibold text-sm">{scenarioNameFor(selectedDialect, selectedScenario)}</div>
              <div class="text-xs text-ink/50 mt-0.5">{t(`scenario.${selectedScenario}.desc` as any)}</div>
            </div>
          </button>
        {/if}
        </div>
      </div>
    </div>

    <!-- Start -->
    <div class="mt-2 sm:mt-16 flex flex-col items-center gap-3">
      {#if !signedIn}
        <div class="text-sm text-ink/60 text-center px-4 space-y-1">
          {#if (user?.seconds ?? 0) > 0}
            {@const parts = t("home.freeLeft").split("{balance}")}
            <p>{parts[0] ?? ""}<span class="font-semibold text-ink">{formatBalance(user.seconds, t("unit.minutes"), t("unit.seconds"))}</span>{parts[1] ?? ""}</p>
          {/if}
          <p>
            <button onclick={() => showSignIn = true} class="underline hover:text-ink">{t("home.createAccount")}</button>
          </p>
        </div>
      {/if}
      <button
        onclick={startSession}
        disabled={!canStart}
        class="btn-primary py-3 px-8 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-6.5 10a.5.5 0 0 1 .5.5 6 6 0 0 0 12 0 .5.5 0 0 1 1 0 7 7 0 0 1-6.5 6.97V21h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.53A7 7 0 0 1 5.5 11.5a.5.5 0 0 1 .5-.5z"/>
        </svg>
        {t("home.start")}
      </button>
    </div>

    {#if !signedIn}
      <section aria-labelledby="dialects-heading" class="mt-20 sm:mt-28">
        <h2 id="dialects-heading" class="font-display font-bold text-2xl mb-4">
          {t("landing.dialectsTitle")}
        </h2>
        <div class="grid grid-cols-2 gap-2">
          {#each dialects as d}
            <DialectCard dialect={d} href={`/${d.key}/`} />
          {/each}
        </div>
      </section>

      <section aria-labelledby="how-heading" class="mt-16">
        <h2 id="how-heading" class="font-display font-bold text-2xl mb-6">
          {t("landing.howTitle")}
        </h2>
        <div class="space-y-4">
          <div class="card">
            <div class="font-semibold">{t("landing.step1Title")}</div>
            <div class="text-ink/60 text-sm mt-1">{t("landing.step1Body")}</div>
          </div>
          <div class="card">
            <div class="font-semibold">{t("landing.step2Title")}</div>
            <div class="text-ink/60 text-sm mt-1">{t("landing.step2Body")}</div>
          </div>
          <div class="card">
            <div class="font-semibold">{t("landing.step3Title")}</div>
            <div class="text-ink/60 text-sm mt-1">{t("landing.step3Body")}</div>
          </div>
        </div>
      </section>

      <section aria-labelledby="faq-heading" class="mt-16">
        <h2 id="faq-heading" class="font-display font-bold text-2xl mb-6">
          {t("faq.heading")}
        </h2>
        <div class="space-y-4">
          <details class="card">
            <summary class="font-semibold cursor-pointer">{t("faq.q0")}</summary>
            <p class="text-ink/70 text-sm mt-2 leading-relaxed">{t("faq.a0")}</p>
          </details>
          <details class="card">
            <summary class="font-semibold cursor-pointer">{t("faq.q1")}</summary>
            <p class="text-ink/70 text-sm mt-2 leading-relaxed">{t("faq.a1")}</p>
          </details>
          <details class="card">
            <summary class="font-semibold cursor-pointer">{t("faq.q2")}</summary>
            <p class="text-ink/70 text-sm mt-2 leading-relaxed">{t("faq.a2")}</p>
          </details>
          <details class="card">
            <summary class="font-semibold cursor-pointer">{t("faq.q3")}</summary>
            <p class="text-ink/70 text-sm mt-2 leading-relaxed">{t("faq.a3")}</p>
          </details>
          <details class="card">
            <summary class="font-semibold cursor-pointer">{t("faq.q4")}</summary>
            <p class="text-ink/70 text-sm mt-2 leading-relaxed">{t("faq.a4")}</p>
          </details>
          <details class="card">
            <summary class="font-semibold cursor-pointer">{t("faq.q6")}</summary>
            <p class="text-ink/70 text-sm mt-2 leading-relaxed">{t("faq.a6")}</p>
          </details>
          <details class="card">
            <summary class="font-semibold cursor-pointer">{t("faq.q7")}</summary>
            <p class="text-ink/70 text-sm mt-2 leading-relaxed">{t("faq.a7")}</p>
          </details>
        </div>
      </section>
    {/if}

  {/if}
</main>

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

<!-- Dialect modal, cards float bare on blurred background, same layout as main -->
{#if showDialectModal}
  <div
    class="fixed inset-0 z-50 bg-ink/60 backdrop-blur-md overflow-y-auto"
    onclick={() => showDialectModal = false}
    role="dialog"
    aria-modal="true"
  >
    <div class="max-w-4xl mx-auto px-6 pointer-events-none">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-20 mb-12 pointer-events-auto" onclick={(e) => e.stopPropagation()}>
        {#each dialects as d}
          <DialectCard dialect={d} selected={selectedDialect === d.key} onclick={() => pickDialect(d.key)} />
        {/each}
      </div>
    </div>
  </div>
{/if}

<!-- Situation modal, fills viewport on desktop (≥ sm), scrolls on mobile -->
{#if showScenarioModal}
  <div
    class="fixed inset-0 z-50 bg-ink/60 backdrop-blur-md flex flex-col overflow-y-auto sm:overflow-hidden"
    onclick={() => showScenarioModal = false}
    role="dialog"
    aria-modal="true"
  >
    <div class="max-w-4xl w-full mx-auto px-8 sm:px-6 pt-20 pb-6 flex flex-col sm:flex-1 sm:min-h-0 pointer-events-none">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:flex-1 sm:min-h-0 pointer-events-auto [&_button]:min-h-[88px] sm:[&_button]:min-h-0" onclick={(e) => e.stopPropagation()}>
        <!-- News -->
        <button onclick={() => pickScenario("news")} class="card relative overflow-hidden text-left transition-all duration-150 hover:-translate-y-1 hover:shadow-md">
          <img src="/situations/news.jpg" alt="" class="absolute right-0 top-0 h-full w-1/2 object-cover pointer-events-none" />
          <div class="absolute inset-0 bg-[linear-gradient(to_right,white_50%,transparent_60%)] pointer-events-none"></div>
          <div class="relative">
            <!-- Title = target language (the dialect to learn).
                 Subtitle = user UI language. Don't swap. -->
            <div class="font-semibold text-sm">{scenarioNameFor(selectedDialect, "news", "Aktuelli Nüüs")}</div>
            <div class="text-xs text-ink/50 mt-0.5">{t("home.newsSubtitle")}</div>
          </div>
        </button>
        <!-- Scenarios -->
        {#each scenarios as s}
          <button onclick={() => pickScenario(s.key)} class="card relative overflow-hidden text-left transition-all duration-150 hover:-translate-y-1 hover:shadow-md">
            {#if s.image}
              <img src={s.image} alt="" class="absolute right-0 top-0 h-full w-1/2 object-cover pointer-events-none" />
              <div class="absolute inset-0 bg-[linear-gradient(to_right,white_50%,transparent_60%)] pointer-events-none"></div>
            {/if}
            <div class="relative">
              <!-- Title = target language (the dialect to learn).
                   Subtitle = user UI language. Don't swap. -->
              <div class="font-semibold text-sm">{scenarioNameFor(selectedDialect, s.key)}</div>
              <div class="text-xs text-ink/50 mt-0.5">{t(`scenario.${s.key}.desc` as any)}</div>
            </div>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<!-- News article modal, cards float bare on blurred background -->
{#if showNewsModal}
  <div
    class="fixed inset-0 z-[60] bg-ink/60 backdrop-blur-md overflow-y-auto"
    onclick={() => showNewsModal = false}
    role="dialog"
    aria-modal="true"
  >
    <div class="max-w-4xl mx-auto px-8 sm:px-6 pointer-events-none">
      <div class="mt-20 mb-12 pointer-events-auto" onclick={(e) => e.stopPropagation()}>
        <NewsPanel onselect={pickArticle} selected={selectedArticle} />
      </div>
    </div>
  </div>
{/if}

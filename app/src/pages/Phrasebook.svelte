<script lang="ts">
  import { onMount } from "svelte";
  import { push } from "../lib/router.svelte";
  import { getSession } from "../lib/auth";
  import { api, type VocabRow } from "../lib/api";
  import TopNav from "../components/TopNav.svelte";
  import SignIn from "./SignIn.svelte";
  import { t } from "../lib/i18n.svelte";

  let vocab = $state<VocabRow[]>([]);
  let loading = $state(true);
  let signedIn = $state(false);
  let showSignIn = $state(false);

  onMount(async () => {
    signedIn = !!getSession();
    // Anonymous and signed-in have separate vocab. Always fetch.
    await load();
  });

  async function load() {
    loading = true;
    const r = await api.phrasebook();
    vocab = r.vocabulary;
    loading = false;
  }

  async function del(id: string) {
    await api.deletePhrase(id);
    vocab = vocab.filter((v) => v.id !== id);
  }

  let grouped = $derived(
    vocab.reduce<Record<string, VocabRow[]>>((acc, v) => {
      (acc[v.dialect] ||= []).push(v);
      return acc;
    }, {})
  );
</script>

<TopNav current="phrasebook" />

<main class="max-w-3xl mx-auto px-4 py-8">
  <h1 class="font-display font-bold text-3xl mb-6">{t("phrasebook.title")}</h1>

  {#if loading}
    <div class="text-ink/40">…</div>
  {:else if vocab.length === 0}
    <div class="card text-center py-10">
      <div class="font-semibold">{t("phrasebook.empty")}</div>
      <div class="text-ink/60 text-sm mt-1">{t("phrasebook.emptyBody")}</div>
    </div>
  {:else}
    {#each Object.entries(grouped) as [dialect, items]}
      <div class="mb-6">
        <h2 class="font-display font-bold text-lg mb-2 capitalize">{dialect}</h2>
        <div class="space-y-2">
          {#each items as v}
            <div class="card flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="font-semibold">{v.expression}</div>
                <div class="text-sm text-ink/60">{v.standard_german}</div>
                {#if v.explanation}
                  <div class="text-xs text-ink/50 mt-1">{v.explanation}</div>
                {/if}
              </div>
              <button onclick={() => del(v.id)} class="text-ink/30 hover:text-red-swiss text-sm">×</button>
            </div>
          {/each}
        </div>
      </div>
    {/each}
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

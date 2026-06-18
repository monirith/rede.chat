<script lang="ts">
  import { onMount } from "svelte";
  import { push } from "../lib/router.svelte";
  import { getLastFeedback } from "../lib/store";
  import { api } from "../lib/api";
  import TopNav from "../components/TopNav.svelte";
  import { t } from "../lib/i18n.svelte";

  let data = $state(getLastFeedback());
  let saved = $state<Set<number>>(new Set());

  onMount(() => {
    if (!data) push("/app");
  });

  async function save(i: number, item: { said: string; correction: string; why: string }) {
    if (!data) return;
    try {
      await api.savePhrase({
        dialect: data.dialect,
        expression: item.correction,
        standard_german: item.said,
        explanation: item.why,
        source_session_id: null,
      });
      saved = new Set(saved).add(i);
    } catch (e) {
      console.error(e);
    }
  }
</script>

<TopNav current="" />

<main class="max-w-3xl mx-auto px-4 py-8">
  {#if data}
    <div class="mb-6">
      <a href="/app" class="text-ink/50 text-sm">← {t("nav.practice")}</a>
      <h1 class="font-display font-bold text-3xl mt-2">{t("feedback.title")}</h1>
      <p class="text-ink/60 mt-1">
        {data.dialect} · {data.scenario.replace("_", " ")} ·
        {Math.floor((data.endedAt - data.startedAt) / 60000)} min
      </p>
    </div>

    {#if data.feedback.length === 0}
      <div class="card text-center py-10">
        <div class="text-3xl mb-2">🎉</div>
        <div class="font-semibold">{t("feedback.noErrors")}</div>
        <div class="text-ink/60 text-sm mt-1">{t("feedback.noErrorsBody")}</div>
      </div>
    {:else}
      <h2 class="font-display font-bold text-xl mb-3">{t("feedback.whatComeUp")}</h2>
      <div class="space-y-3">
        {#each data.feedback as item, i}
          <div class="card">
            <div class="text-sm text-ink/50">{t("feedback.youSaid")}</div>
            <div class="font-mono text-sm bg-ink/5 rounded p-2 mt-1">"{item.said}"</div>
            <div class="text-sm text-ink/50 mt-3">{t("feedback.better")}</div>
            <div class="font-semibold mt-1">{item.correction}</div>
            <div class="text-sm text-ink/70 mt-2">{item.why}</div>
            <button
              onclick={() => save(i, item)}
              disabled={saved.has(i)}
              class="btn-ghost mt-3 text-sm disabled:opacity-50"
            >
              {saved.has(i) ? t("feedback.saved") : t("feedback.save")}
            </button>
          </div>
        {/each}
      </div>
    {/if}

    <div class="mt-8 flex gap-3">
      <a href="/app" class="btn-primary flex-1 text-center">{t("feedback.again")}</a>
      <a href="/history" class="btn-ghost flex-1 text-center">{t("feedback.history")}</a>
    </div>
  {/if}
</main>

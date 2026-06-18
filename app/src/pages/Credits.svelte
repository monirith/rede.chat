<script lang="ts">
  import { onMount } from "svelte";
  import { getSession } from "../lib/auth";
  import { api, type CreditPack, type UserInfo } from "../lib/api";
  import TopNav from "../components/TopNav.svelte";
  import { formatBalance } from "../lib/format";
  import { t } from "../lib/i18n.svelte";

  let packs = $state<CreditPack[]>([]);
  let user = $state<UserInfo | null>(null);
  let loading = $state(true);
  let buying = $state(false);
  let statusMessage = $state<string | null>(null);
  let selectedPack = $state<CreditPack | null>(null);

  onMount(async () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("status") === "success") statusMessage = t("credits.success");
    if (params.get("status") === "cancel") statusMessage = t("credits.cancel");
    const [p, m] = await Promise.all([api.packs(), api.me()]);
    packs = p.packs;
    user = m.user;
    loading = false;
  });

  function openBuyModal(pack: CreditPack) {
    selectedPack = pack;
  }

  function closeBuyModal() {
    if (buying) return;
    selectedPack = null;
  }

  async function confirmBuy(e: Event) {
    e.preventDefault();
    if (!selectedPack) return;
    buying = true;
    try {
      const r = await api.checkout(selectedPack.key);
      window.location.href = r.url;
    } catch (e: any) {
      statusMessage = String(e.message ?? e);
      buying = false;
    }
  }
</script>

<TopNav current="credits" />

<main class="max-w-3xl mx-auto px-4 py-8">
  <h1 class="font-display font-bold text-3xl mb-2">{t("credits.title")}</h1>
  {#if user}
    <p class="text-ink/60 mb-6">{t("credits.balance")}: <span class="font-semibold">{formatBalance(user.seconds, t("unit.minutes"), t("unit.seconds"))}</span></p>
  {/if}

  {#if statusMessage}
    <div class="card mb-4 border-accent/40 bg-accent/5 text-sm">{statusMessage}</div>
  {/if}

  {#if loading}
    <div class="text-ink/40">…</div>
  {:else}
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      {#each packs as p}
        <div class="card flex flex-col items-center justify-between gap-4 h-32">
          <div class="font-semibold text-lg">{t(`pack.${p.key}` as any) ?? p.label}</div>
          <button
            onclick={() => openBuyModal(p)}
            class="btn-primary w-full"
          >
            CHF {(p.amountChf / 100).toFixed(2)}
          </button>
        </div>
      {/each}
    </div>
  {/if}

  <div class="mt-8 space-y-1 text-xs text-ink/40">
    <p>{t("credits.bySecond")}</p>
    <p>{t("credits.noSubscription")}</p>
  </div>
</main>

{#if selectedPack}
  <div
    class="fixed inset-0 z-50 bg-ink/60 backdrop-blur-md flex items-center justify-center px-6"
    onclick={(e) => { if (e.target === e.currentTarget) closeBuyModal(); }}
    role="dialog"
    aria-modal="true"
  >
    <div class="bg-cream rounded-2xl p-8 w-full max-w-sm shadow-xl" onclick={(e) => e.stopPropagation()}>
      <h2 class="font-display font-bold text-2xl">{t("credits.buyTitle")} {t(`pack.${selectedPack.key}` as any) ?? selectedPack.label}</h2>

      <form onsubmit={confirmBuy} class="mt-6 space-y-3">
        <div class="flex gap-2 pt-2">
          <button type="submit" class="btn-primary flex-1" disabled={buying}>
            {buying ? "…" : `${t("credits.pay")} CHF ${(selectedPack.amountChf / 100).toFixed(2)}`}
          </button>
          <button type="button" onclick={closeBuyModal} class="btn-ghost" disabled={buying}>
            {t("credits.cancelButton")}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

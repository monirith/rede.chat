<script lang="ts">
  import type { DialectInfo } from "../lib/catalog";
  import { t } from "../lib/i18n.svelte";

  let {
    dialect,
    selected = false,
    onclick = undefined,
    href = undefined,
  }: {
    dialect: DialectInfo;
    selected?: boolean;
    onclick?: () => void;
    href?: string;
  } = $props();

  const cls = `card text-left relative overflow-hidden w-full h-full transition-all duration-150 ${
    onclick || href ? "hover:-translate-y-1 hover:shadow-md" : "cursor-default"
  }`;

  // Multi-canton clusters (Ost/Innerschweiz) render a small 3-col grid of
  // shields in the same right-side slot. Single-canton dialects render the
  // one big shield as before.
  let showGrid = $derived(Array.isArray(dialect.cantons) && dialect.cantons.length > 1);
</script>

{#snippet shield()}
  {#if showGrid}
    <div
      class="absolute right-2 top-1/2 -translate-y-1/2 grid grid-cols-3 gap-0.5 pointer-events-none select-none w-16"
      aria-hidden="true"
    >
      {#each dialect.cantons as code}
        <img src="/cantons/{code}.svg" alt="" class="w-5 h-5 object-contain" />
      {/each}
    </div>
  {:else if dialect.canton}
    <img
      src="/cantons/{dialect.canton}.svg"
      alt=""
      aria-hidden="true"
      class="absolute right-0 top-1/2 -translate-y-1/2 h-14 w-14 pointer-events-none select-none"
    />
  {/if}
{/snippet}

{#if href}
  <a {href} class={cls} aria-label={`${dialect.name} - ${t(`region.${dialect.key}` as any)}`}>
    {@render shield()}
    <div class="relative font-semibold">{dialect.name}</div>
    <div class="relative text-xs text-ink/50 mt-0.5">{t(`region.${dialect.key}` as any)}</div>
    <div class="relative text-xs text-ink/40 mt-0.5">{dialect.speakers} {t("unit.speakers")}</div>
  </a>
{:else}
  <button {onclick} class={cls}>
    {@render shield()}
    <div class="relative font-semibold">{dialect.name}</div>
    <div class="relative text-xs text-ink/50 mt-0.5">{t(`region.${dialect.key}` as any)}</div>
    <div class="relative text-xs text-ink/40 mt-0.5">{dialect.speakers} {t("unit.speakers")}</div>
  </button>
{/if}

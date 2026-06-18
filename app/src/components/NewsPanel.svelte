<script lang="ts">
  import { t } from "../lib/i18n.svelte";

  let {
    onselect,
    selected = null,
  }: {
    onselect: (article: { title: string; title1: string; title2: string; body: string; image?: string }) => void;
    selected?: { title: string; title1: string; title2: string; body: string; image?: string } | null;
  } = $props();

  interface NewsItem {
    title1: string;
    title2: string;
    image: string;
    link: string;
  }

  let items = $state<NewsItem[]>([]);
  let loading = $state(true);
  let error = $state(false);
  let fetching = $state<string | null>(null);

  const RSS_URL = "https://www.srf.ch/news/bnf/rss/1646";

  function splitTitle(raw: string): [string, string] {
    const idx = raw.indexOf(" – ");
    if (idx !== -1) return [raw.slice(0, idx), raw.slice(idx + 3)];
    const idx2 = raw.indexOf(" - ");
    if (idx2 !== -1) return [raw.slice(0, idx2), raw.slice(idx2 + 3)];
    return [raw, ""];
  }

  function extractImage(description: string): string {
    const m = description.match(/src="([^"]+)"/);
    return m ? m[1] : "";
  }

  async function load() {
    try {
      const res = await fetch(RSS_URL);
      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, "text/xml");
      items = Array.from(doc.querySelectorAll("item")).map((el) => {
        const raw = el.querySelector("title")?.textContent ?? "";
        const [title1, title2] = splitTitle(raw);
        const desc = el.querySelector("description")?.textContent ?? "";
        const link = el.querySelector("link")?.textContent?.trim()
          ?? el.getElementsByTagName("link")[0]?.textContent?.trim()
          ?? "";
        return { title1, title2, image: extractImage(desc), link };
      });
    } catch {
      error = true;
    }
    loading = false;
  }

  async function pick(item: NewsItem) {
    if (fetching) return;
    fetching = item.link;
    try {
      const res = await fetch(item.link);
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const bodyEl = doc.querySelector("[data-news-landmark='article-content'], [itemprop='articleBody']");
      const body = bodyEl
        ? Array.from(bodyEl.querySelectorAll("p")).map((p) => p.textContent).join(" ").trim()
        : "";
      onselect({ title: `${item.title1}${item.title2 ? " – " + item.title2 : ""}`, title1: item.title1, title2: item.title2, body, image: item.image || undefined });
    } catch {
      error = true;
    }
    fetching = null;
  }

  $effect(() => { load(); });
</script>

{#if loading}
  <div class="text-cream/60 text-sm py-4">{t("home.newsLoading")}</div>
{:else if error}
  <div class="text-red-400 text-sm py-4">{t("home.newsError")}</div>
{:else}
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
    {#each items as item}
      {@const isSelected = selected?.title === item.title1 + (item.title2 ? ' – ' + item.title2 : '')}
      <button
        onclick={() => pick(item)}
        disabled={!!fetching}
        class="card relative overflow-hidden text-left p-3 transition-all duration-150 hover:-translate-y-1 hover:shadow-md disabled:opacity-50 {isSelected ? 'ring-2 ring-ink' : ''}"
      >
        {#if item.image}
          <img src={item.image} alt="" class="absolute right-0 top-0 h-full w-1/2 object-cover pointer-events-none" loading="lazy" />
          <div class="absolute inset-0 bg-[linear-gradient(to_right,white_50%,transparent_60%)] pointer-events-none"></div>
        {/if}
        <div class="relative">
          <div class="font-semibold text-xs leading-snug line-clamp-2 text-outline-white">{item.title1}</div>
          {#if item.title2}
            <div class="text-[10px] text-ink/50 mt-0.5 line-clamp-1 text-outline-white">{item.title2}</div>
          {/if}
          {#if fetching === item.link}
            <div class="text-xs text-ink/40 mt-0.5">…</div>
          {/if}
        </div>
      </button>
    {/each}
  </div>
{/if}

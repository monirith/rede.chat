<script lang="ts">
  import { onMount } from "svelte";
  import { push } from "../lib/router.svelte";
  import { getSession, signOut } from "../lib/auth";
  import { api, type UserInfo, type ProgressRow } from "../lib/api";
  import TopNav from "../components/TopNav.svelte";
  import { t } from "../lib/i18n.svelte";
  import { loadKnowledge, setKnowledgeEnabled, deleteKnowledgeItem, type KnowledgeStore } from "../lib/knowledge";

  let user = $state<UserInfo | null>(null);
  let progress = $state<ProgressRow[]>([]);
  let loading = $state(true);
  let editingName = $state(false);
  let nameInput = $state("");
  let saving = $state(false);
  let kb = $state<KnowledgeStore>({ enabled: true, items: [] });

  onMount(async () => {
    if (!getSession()) { push("/signin"); return; }
    const [m, p] = await Promise.all([api.me(), api.progress()]);
    user = m.user;
    progress = p.progress;
    kb = loadKnowledge();
    loading = false;
  });

  function toggleKnowledge() {
    kb.enabled = !kb.enabled;
    setKnowledgeEnabled(kb.enabled);
  }

  function removeItem(id: string) {
    deleteKnowledgeItem(id);
    kb = { ...kb, items: kb.items.filter((i) => i.id !== id) };
  }

  function minutes(s: number): string {
    return `${Math.floor(s / 60)} min`;
  }

  function startEditName() {
    nameInput = user?.name ?? "";
    editingName = true;
  }

  async function saveName() {
    if (!user) return;
    saving = true;
    await api.updateMe({ name: nameInput.trim() });
    user = { ...user, name: nameInput.trim() || null };
    editingName = false;
    saving = false;
  }
</script>

<TopNav current="profile" />

<main class="max-w-3xl mx-auto px-4 py-8">
  <div class="flex items-center justify-between mb-6">
    <h1 class="font-display font-bold text-3xl">{t("profile.title")}</h1>
    {#if !loading && user}
      <button onclick={signOut} class="btn-ghost text-sm">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        {t("nav.signOut")}
      </button>
    {/if}
  </div>
  {#if loading}
    <div class="text-ink/40">…</div>
  {:else if user}
    <div class="card mb-6 space-y-4">
      <div>
        <div class="text-sm text-ink/60 mb-1">{t("profile.name")}</div>
        {#if editingName}
          <div class="flex items-center gap-2">
            <input
              type="text"
              bind:value={nameInput}
              placeholder="Your name"
              class="flex-1 px-3 py-1.5 rounded-md border border-ink/15 focus:outline-none focus:border-ink text-sm"
              onkeydown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") editingName = false; }}
            />
            <button onclick={saveName} disabled={saving} class="btn-primary text-sm px-3 py-1.5 disabled:opacity-50">
              {saving ? "…" : "Save"}
            </button>
            <button onclick={() => editingName = false} class="btn-ghost text-sm px-3 py-1.5">✕</button>
          </div>
        {:else}
          <div class="flex items-center justify-between">
            <div class="font-medium">{user.name ?? "—"}</div>
            <button onclick={startEditName} class="text-xs text-ink/50 hover:text-ink">Edit</button>
          </div>
        {/if}
      </div>
      <div>
        <div class="text-sm text-ink/60">{t("profile.email")}</div>
        <div class="font-medium">{user.email}</div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3 mb-6">
      <div class="card">
        <div class="text-sm text-ink/60">{t("profile.streak")}</div>
        <div class="font-display font-bold text-3xl mt-1">🔥 {user.current_streak}</div>
      </div>
      <div class="card">
        <div class="text-sm text-ink/60">{t("profile.longest")}</div>
        <div class="font-display font-bold text-3xl mt-1">{user.longest_streak}</div>
      </div>
    </div>

    <h2 class="font-display font-bold text-xl mb-3">{t("profile.perDialect")}</h2>
    {#if progress.length === 0}
      <div class="card text-center text-ink/60 py-6">{t("profile.empty")}</div>
    {:else}
      <div class="space-y-2 mb-8">
        {#each progress as p}
          <div class="card flex items-center justify-between">
            <div class="font-medium capitalize">{p.dialect}</div>
            <div class="text-right">
              <div class="font-mono text-sm">{minutes(p.total_seconds)}</div>
              <div class="text-xs text-ink/50">{p.session_count}</div>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <div class="mb-8">
      <h2 class="font-display font-bold text-xl mb-3">Privacy</h2>
      <div class="card">
        <div class="flex items-center justify-between">
          <div>
            <div class="font-medium">AI Knowledge base</div>
            <div class="text-xs text-ink/50 mt-0.5">The AI remembers personal details to personalise conversations. Stored on this device only.</div>
          </div>
          <button
            onclick={toggleKnowledge}
            class="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-150 focus:outline-none {kb.enabled ? 'bg-ink' : 'bg-ink/20'}"
            role="switch"
            aria-checked={kb.enabled}
          >
            <span class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-150 {kb.enabled ? 'translate-x-5' : 'translate-x-0'}"></span>
          </button>
        </div>

        {#if kb.enabled}
          <div class="mt-4 space-y-2">
            {#if kb.items.length === 0}
              <div class="text-sm text-ink/40">No details recorded yet. They appear here after conversations.</div>
            {:else}
              {#each kb.items as item (item.id)}
                <div class="flex items-start justify-between gap-2 py-1.5 border-t border-ink/8 first:border-0">
                  <div class="text-sm leading-snug">{item.text}</div>
                  <button onclick={() => removeItem(item.id)} class="text-ink/30 hover:text-ink shrink-0 text-lg leading-none">×</button>
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    </div>

  {/if}
</main>

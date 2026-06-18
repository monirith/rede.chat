<script lang="ts">
  import { onMount } from "svelte";
  import { api, type SessionSummary } from "../lib/api";
  import { getSession } from "../lib/auth";
  import TopNav from "../components/TopNav.svelte";
  import SignIn from "./SignIn.svelte";
  import { formatDate, formatDuration } from "../lib/format";
  import { t } from "../lib/i18n.svelte";
  import { getTranscript, type LocalTranscript } from "../lib/local-store";
  import { getUserTurnsForSession, type UserTurnRecord } from "../lib/audio-store";

  let sessions = $state<SessionSummary[]>([]);
  let transcripts = $state<Record<string, LocalTranscript | null>>({});
  // Per session: array of {turnIdx, blob, durationMs}. Each entry is one user
  // utterance, indexed in chronological order (same order they were spoken).
  let userAudio = $state<Record<string, UserTurnRecord[]>>({});
  let playingKey = $state<string | null>(null);    // `${sessionId}:${turnIdx}`
  let activeAudio: HTMLAudioElement | null = null;
  let loading = $state(true);
  let signedIn = $state(false);
  let showSignIn = $state(false);

  onMount(async () => {
    signedIn = !!getSession();
    // Anonymous and signed-in are separate identities; both have their own
    // history. Always fetch — the worker returns the right rows for whichever
    // identity is on this request.
    const r = await api.history();
    sessions = r.sessions;
    const tMap: Record<string, LocalTranscript | null> = {};
    const aMap: Record<string, UserTurnRecord[]> = {};
    for (const s of sessions) {
      tMap[s.id] = getTranscript(s.id);
      try {
        aMap[s.id] = await getUserTurnsForSession(s.id);
      } catch {
        aMap[s.id] = [];
      }
    }
    transcripts = tMap;
    userAudio = aMap;
    loading = false;
  });

  function playUserTurn(sessionId: string, rec: UserTurnRecord) {
    if (activeAudio) {
      try { activeAudio.pause(); URL.revokeObjectURL(activeAudio.src); } catch {}
      activeAudio = null;
    }
    const url = URL.createObjectURL(rec.blob);
    const key = `${sessionId}:${rec.turnIdx}`;
    activeAudio = new Audio(url);
    playingKey = key;
    activeAudio.onended = () => {
      if (playingKey === key) playingKey = null;
      try { URL.revokeObjectURL(url); } catch {}
    };
    activeAudio.play().catch(() => { playingKey = null; });
  }

  function fmtSecs(ms: number): string {
    const s = Math.round(ms / 1000);
    return `${s}s`;
  }

  function scenarioLabel(k: string): string {
    return k.replace("_", " ");
  }
</script>

<TopNav current="history" />

<main class="max-w-3xl mx-auto px-4 py-8">
  <h1 class="font-display font-bold text-3xl mb-6">{t("history.title")}</h1>

  {#if loading}
    <div class="text-ink/40">…</div>
  {:else if sessions.length === 0}
    <div class="card text-center py-10">
      <div class="font-semibold">{t("history.empty")}</div>
      <div class="text-ink/60 text-sm mt-1">{t("history.emptyBody")}</div>
    </div>
  {:else}
    <div class="space-y-2">
      {#each sessions as s}
        <div class="card">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="font-semibold capitalize">{s.dialect} · {scenarioLabel(s.scenario)}</div>
              <div class="text-sm text-ink/60 mt-0.5">{formatDate(s.started_at)}</div>
            </div>
            <div class="text-right text-sm">
              <div class="font-mono">{formatDuration(s.duration_seconds)}</div>
              <div class="text-ink/40 text-xs">−{formatDuration(s.seconds_used)}</div>
            </div>
          </div>

          {#if s.feedback_json && s.feedback_json !== "[]"}
            <details class="mt-3">
              <summary class="text-sm text-ink/60 cursor-pointer">{t("history.viewFeedback")}</summary>
              <div class="mt-2 space-y-2 text-sm">
                {#each JSON.parse(s.feedback_json) as f}
                  <div class="border-l-2 border-ink/20 pl-3">
                    <div class="text-ink/60">"{f.said}"</div>
                    <div class="font-medium">→ {f.correction}</div>
                    <div class="text-ink/50 text-xs">{f.why}</div>
                  </div>
                {/each}
              </div>
            </details>
          {/if}

          {#if transcripts[s.id]}
            {@const t = transcripts[s.id]!}
            {@const audio = userAudio[s.id] ?? []}
            <details class="mt-2">
              <summary class="text-sm text-ink/60 cursor-pointer">Transcript</summary>
              <div class="mt-2 space-y-1.5 text-sm">
                {#each t.turns as turn, ti}
                  {#if turn.role === "user"}
                    <!-- User turn = audio only. Map this user-row to its
                         IndexedDB-stored wav via the count of user rows seen. -->
                    {@const userIdx = t.turns.slice(0, ti + 1).filter((x) => x.role === "user").length - 1}
                    {@const rec = audio.find((a) => a.turnIdx === userIdx)}
                    <div class="text-right">
                      <span class="text-xs uppercase tracking-wider opacity-50 mr-1.5">You</span>
                      {#if rec}
                        <button
                          type="button"
                          onclick={() => playUserTurn(s.id, rec)}
                          class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-ink/5 hover:bg-ink/10 transition-colors"
                        >
                          <span aria-hidden="true">{playingKey === `${s.id}:${userIdx}` ? '⏵' : '▶'}</span>
                          <span class="text-xs text-ink/60">{fmtSecs(rec.durationMs)}</span>
                        </button>
                      {:else}
                        <span class="text-xs text-ink/30">no audio</span>
                      {/if}
                    </div>
                  {:else}
                    <div class="text-ink/60">
                      <span class="text-xs uppercase tracking-wider opacity-50 mr-1.5">AI</span>{turn.text}
                    </div>
                  {/if}
                {/each}
              </div>
            </details>
          {:else}
            <div class="mt-2 text-xs text-ink/30">Transcript not on this device.</div>
          {/if}
        </div>
      {/each}
    </div>
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

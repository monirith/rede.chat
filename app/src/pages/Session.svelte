<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { push } from "../lib/router.svelte";
  import { getAuthToken } from "../lib/auth";
  import { GeminiLiveSession, type SessionState } from "../lib/gemini-live";
  import { setLastFeedback } from "../lib/store";
  import { saveTranscript } from "../lib/local-store";
  import { loadKnowledge } from "../lib/knowledge";
  import { putUserTurn, getUserTurn } from "../lib/audio-store";
  import { t } from "../lib/i18n.svelte";
  import { api } from "../lib/api";

  const HARD_CAP_SECONDS = 15 * 60;

  let dialect = $state("zuri");
  let scenario = $state("free_talk");
  let newsContext = $state<{ title: string; body: string } | undefined>(undefined);
  let liveState = $state<SessionState>("idle");
  let elapsed = $state(0);
  let transcript = $state<{ role: "user" | "model"; text: string }[]>([]);
  let error = $state<string | null>(null);

  // iOS in-app browsers (WhatsApp, Instagram, FB, Line, etc.) block
  // getUserMedia entirely. The mic call fails with a cryptic "not allowed"
  // error. Detect upfront so we can show a "Open in Safari" hint instead.
  const isIOSInAppBrowser = (() => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    if (!isIOS) return false;
    // Safari has "Safari" in UA AND no other browser markers.
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser/.test(ua);
    // Known in-app webviews (UA contains app name or no Safari token at all).
    const inAppMarkers = /WhatsApp|FBAN|FBAV|Instagram|Line|MicroMessenger|Twitter|LinkedInApp|TikTok/i;
    return inAppMarkers.test(ua) || !isSafari;
  })();

  let userSeconds = $state<number | null>(null);
  let session: GeminiLiveSession | null = null;
  let timer: number | undefined;
  let startedAt = 0;
  let sessionId: string = crypto.randomUUID();

  // Replay speed (applied to HTMLAudioElement.playbackRate with preservesPitch=true).
  let replaySpeed = $state<0.7 | 0.85 | 1>(1);
  const SPEED_PRESETS: { value: 0.7 | 0.85 | 1; label: string }[] = [
    { value: 0.7, label: "1" },
    { value: 0.85, label: "2" },
    { value: 1, label: "3" },
  ];
  // Single shared audio element for replays so only one plays at a time.
  let replayEl: HTMLAudioElement | null = null;
  let replayingTurn = $state<number | null>(null);

  // CEFR-style difficulty level. C = unrestricted (native).
  type Level = "A" | "B" | "C";
  let level = $state<Level>("A");
  const LEVEL_PROMPTS: Record<Level, string> = {
    A: "Switch to A1 beginner level for the rest of this conversation. Use very simple sentences (one clause), basic everyday vocabulary, mostly present tense. Speak slowly and clearly. Avoid idioms, slang, and complex grammar. If the user struggles, simplify further.",
    B: "Switch to B1 intermediate level for the rest of this conversation. Use everyday vocabulary, varied tenses (past, present, future), and natural sentence structure. Avoid rare or technical words. Speak at a natural pace.",
    C: "Switch back to your unrestricted native register. Speak as you would with a native speaker — full vocabulary, idioms, complex grammar all fair game. Natural pace.",
  };

  function setLevel(l: Level) {
    level = l;
    if (session && liveState === "connected") {
      session.sendContext(LEVEL_PROMPTS[l]);
    }
  }

  onMount(async () => {
    const next = sessionStorage.getItem("rede:next");
    if (next) {
      const parsed = JSON.parse(next);
      dialect = parsed.dialect;
      scenario = parsed.scenario;
      if (parsed.newsContext) newsContext = parsed.newsContext;
    }
    try {
      const m = await api.me();
      userSeconds = m.user.seconds;
    } catch {
      userSeconds = null;
    }
  });

  onDestroy(() => {
    if (timer) clearInterval(timer);
    session?.forceClose();
  });

  function persistTranscript(endedAt: number) {
    if (transcript.length === 0) return;
    saveTranscript({
      sessionId,
      dialect,
      scenario,
      startedAt,
      endedAt,
      turns: transcript.slice(),
    });
  }

  // Save each user-turn wav to IndexedDB keyed by sessionId. Lets the History
  // tab replay what the user actually said on subsequent visits.
  async function persistUserAudio() {
    if (!session) return;
    // Drain any tail-end mic audio Gemini hadn't transcribed yet, otherwise
    // the last user turn comes out empty.
    session.flushPendingUserAudio();
    const count = session.userTurnCount();
    for (let i = 0; i < count; i++) {
      const blob = session.getUserTurnAudioBlob(i);
      if (!blob) continue;
      // Approx duration from the 44-byte WAV header isn't trivial; estimate
      // from blob size: (size − 44) / (16000 sample rate × 2 bytes).
      const durationMs = Math.max(0, Math.round(((blob.size - 44) / 32000) * 1000));
      try {
        await putUserTurn({
          sessionId, turnIdx: i, blob, durationMs, createdAt: Date.now(),
        });
      } catch (e) { console.warn("[audio-store] put failed", e); }
    }
  }

  async function begin() {
    error = null;
    transcript = [];
    const authToken = getAuthToken();

    session = new GeminiLiveSession({
      onStateChange: (s) => { liveState = s; },
      onSessionId: (id) => { sessionId = id; },
      onTranscript: (text, role) => {
        const last = transcript[transcript.length - 1];
        if (last && last.role === role) {
          transcript = [...transcript.slice(0, -1), { role, text: last.text + text }];
        } else {
          transcript = [...transcript, { role, text }];
        }
      },
      onFeedback: (feedback) => {
        const endedAt = Date.now();
        persistTranscript(endedAt);
        // Fire-and-forget: write user mic audio to IndexedDB. Async but we
        // don't gate the feedback navigation on it.
        // ignore: discarded_futures (Svelte/TS doesn't care, just intent)
        persistUserAudio().catch((e) => console.warn(e));
        setLastFeedback({
          dialect, scenario, feedback,
          transcript: transcript.slice(),
          startedAt, endedAt,
        });
        push("/feedback");
      },
      onError: (msg) => { error = msg; },
    });

    startedAt = Date.now();
    const kb = loadKnowledge();
    const knowledge = kb.enabled && kb.items.length ? kb.items.map((i) => i.text) : undefined;
    await session.start(dialect, scenario, authToken, sessionId, newsContext, knowledge, level);
    // Apply any speed selected before the session started (worklet wasn't
    // created yet when setLiveSpeed was first called).
    session.setLiveSpeed(replaySpeed);
    timer = window.setInterval(() => {
      elapsed = Math.floor((Date.now() - startedAt) / 1000);
      if (elapsed >= HARD_CAP_SECONDS) {
        end();
      }
    }, 250);
  }

  function end() {
    if (timer) clearInterval(timer);
    session?.stop();
  }

  function formatTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  $effect(() => {
    if (liveState === "idle" && timer) clearInterval(timer);
  });

  // Map transcript[idx] (which can be a user OR model row) to the AI-turn
  // index expected by GeminiLiveSession.getTurnAudioBlob — count how many
  // model rows appeared in the transcript up to and including idx.
  function aiTurnIdxFor(transcriptIdx: number): number {
    let count = -1;
    for (let i = 0; i <= transcriptIdx; i++) {
      if (transcript[i]?.role === "model") count++;
    }
    return count;
  }

  // Play an AI turn through an HTMLAudioElement at the current speed setting.
  // Always interrupts whatever is playing (manual replay on click).
  function playTurn(aiTurnIdx: number) {
    const blob = session?.getTurnAudioBlob(aiTurnIdx);
    if (!blob) return;
    if (replayEl) {
      try { replayEl.pause(); URL.revokeObjectURL(replayEl.src); } catch {}
    }
    const url = URL.createObjectURL(blob);
    replayEl = new Audio(url);
    replayEl.playbackRate = replaySpeed;
    (replayEl as any).preservesPitch = true;
    replayingTurn = aiTurnIdx;
    replayEl.onended = () => {
      replayingTurn = null;
      try { URL.revokeObjectURL(url); } catch {}
    };
    replayEl.onpause = () => {
      // Treat pause-not-on-end as not playing too
      if (replayEl && replayEl.ended) replayingTurn = null;
    };
    replayEl.play().catch(() => { replayingTurn = null; });
  }

  // Click-to-replay from the transcript: maps transcript row → AI turn index.
  function replayTurn(transcriptIdx: number) {
    if (transcript[transcriptIdx]?.role !== "model") return;
    playTurn(aiTurnIdxFor(transcriptIdx));
  }

  // User turn index = count of user rows up to and including transcriptIdx.
  function userTurnIdxFor(transcriptIdx: number): number {
    let count = -1;
    for (let i = 0; i <= transcriptIdx; i++) {
      if (transcript[i]?.role === "user") count++;
    }
    return count;
  }

  let replayingUserTurn = $state<number | null>(null);
  function playUserTurn(transcriptIdx: number) {
    if (transcript[transcriptIdx]?.role !== "user") return;
    const idx = userTurnIdxFor(transcriptIdx);
    const blob = session?.getUserTurnAudioBlob(idx);
    if (!blob) return;
    if (replayEl) {
      try { replayEl.pause(); URL.revokeObjectURL(replayEl.src); } catch {}
    }
    const url = URL.createObjectURL(blob);
    replayEl = new Audio(url);
    replayEl.playbackRate = replaySpeed;
    (replayEl as any).preservesPitch = true;
    replayingUserTurn = idx;
    replayEl.onended = () => {
      replayingUserTurn = null;
      try { URL.revokeObjectURL(url); } catch {}
    };
    replayEl.play().catch(() => { replayingUserTurn = null; });
  }

  function setSpeed(s: 0.7 | 0.85 | 1) {
    replaySpeed = s;
    // Replay path (HTMLAudioElement) — pitch preserved
    if (replayEl) replayEl.playbackRate = s;
    // Live path (worklet) — sample-rate slowdown, pitch shifts a bit at <1×
    session?.setLiveSpeed(s);
  }
</script>

<!--
  Fullscreen vertical layout, three rows:
    - header (auto height, pinned to top)
    - chat section (flex-1, scrolls, sticks to bottom)
    - footer with mic (auto height, pinned to bottom)
  Anchor-to-bottom trick: the scrolling container uses `flex-col-reverse` and we
  iterate the transcript in reverse. Newest message is first in DOM, so it ends
  up at the visual bottom; older messages are pushed up smoothly as new ones
  arrive. The browser naturally keeps the viewport pinned to the visual bottom
  (scrollTop = 0 in reverse-mode) unless the user scrolls up to read older.
-->
<main class="h-dvh bg-ink text-cream flex flex-col overflow-hidden">
  <header class="p-4 flex items-center justify-between border-b border-cream/10 shrink-0">
    <a href="/app" class="text-cream/60 text-sm">{t("session.back")}</a>
    <div class="text-center">
      <div class="text-xs text-cream/50">{dialect} · {scenario.replace("_", " ")}</div>
      <div class="font-mono text-lg">{formatTime(elapsed)}</div>
    </div>
    <a href="/credits" class="text-right text-xs text-cream/50 hover:text-cream/80 transition-colors">
      {#if userSeconds != null}
        <div>{Math.floor(userSeconds / 60)} min {userSeconds % 60 > 0 ? `${userSeconds % 60} s` : ""}</div>
        <div class="text-cream/30">{t("home.creditsLeft")}</div>
      {/if}
    </a>
  </header>

  {#if isIOSInAppBrowser}
    <div class="mx-4 mt-3 p-4 rounded-lg bg-red-swiss/20 border border-red-swiss/40 text-sm shrink-0">
      <div class="font-medium mb-1">Open in Safari to start</div>
      <div class="text-cream/70">
        Tap the <span class="font-mono">•••</span> menu below and choose
        "Open in Safari" — the mic isn't available inside in-app browsers.
      </div>
    </div>
  {:else if error}
    <div class="mx-4 mt-3 p-4 rounded-lg bg-red-swiss/20 border border-red-swiss/40 text-sm shrink-0">
      {error}
    </div>
  {/if}

  {#if transcript.length === 0 && liveState !== "connected"}
    <section class="flex-1 min-h-0 flex items-center justify-center p-4">
      <div class="text-cream/40 text-sm">{t("session.ready")}</div>
    </section>
  {:else}
    <section class="flex-1 min-h-0 overflow-y-auto flex flex-col-reverse scroll-smooth">
      <div class="p-4 pb-6 max-w-2xl mx-auto w-full flex flex-col-reverse gap-3">
        {#each transcript.slice().reverse() as turn, revIdx (turn)}
          {@const idx = transcript.length - 1 - revIdx}
          {@const isAi = turn.role === "model"}
          {@const turnId = isAi ? aiTurnIdxFor(idx) : userTurnIdxFor(idx)}
          {#if isAi}
            <!-- AI bubble: keep transcript text + tap to replay (model audio
                 is authoritative; transcript matches). -->
            <button
              type="button"
              class="text-left text-cream/60 hover:text-cream cursor-pointer"
              onclick={() => replayTurn(idx)}
            >
              <div class="text-xs uppercase tracking-wider opacity-50 mb-0.5 flex items-center gap-1">
                <span aria-hidden="true">{replayingTurn === turnId ? '⏵' : '▶'}</span>
                <span>AI</span>
              </div>
              <div>{turn.text}</div>
            </button>
          {:else}
            <!-- User bubble: AUDIO ONLY. Gemini's input transcription
                 mis-hears Mundart often enough that the raw mic wav is the
                 only authoritative record. Tap to replay yourself. -->
            <button
              type="button"
              class="text-right cursor-pointer flex flex-col items-end gap-1 group"
              onclick={() => playUserTurn(idx)}
            >
              <div class="text-xs uppercase tracking-wider opacity-50 flex items-center gap-1 justify-end">
                <span>You</span>
                <span aria-hidden="true">{replayingUserTurn === turnId ? '⏵' : '▶'}</span>
              </div>
              <div class="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-cream/10 group-hover:bg-cream/15 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-cream/70">
                  <path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 12h2" stroke-linecap="round" />
                </svg>
                <span class="text-cream/70 text-sm">{replayingUserTurn === turnId ? 'playing…' : 'tap to play'}</span>
              </div>
            </button>
          {/if}
        {/each}
      </div>
    </section>
  {/if}

  <footer class="px-3 py-5 sm:p-6 border-t border-cream/10 shrink-0">
    <div class="max-w-3xl mx-auto flex items-center justify-between gap-2">
      <!-- LEFT: speed (replay only) -->
      <div class="flex flex-col items-center gap-1.5">
        <div class="flex items-center gap-1 sm:gap-2">
          {#each SPEED_PRESETS as preset}
            <button
              type="button"
              onclick={() => setSpeed(preset.value)}
              aria-pressed={replaySpeed === preset.value}
              class="w-9 h-9 sm:w-11 sm:h-11 rounded-full text-xs sm:text-[13px] font-medium flex items-center justify-center transition
                {replaySpeed === preset.value ? 'bg-cream text-ink' : 'bg-transparent text-cream/60 border border-cream/20 hover:text-cream hover:border-cream/40'}"
            >
              {preset.label}
            </button>
          {/each}
        </div>
        <div class="text-[10px] uppercase tracking-widest text-cream/30">speed</div>
      </div>

      <!-- CENTER: mic -->
      <div class="flex flex-col items-center gap-2">
        {#if liveState === "idle" || liveState === "error"}
          <button onclick={begin} disabled={isIOSInAppBrowser} class="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-red-swiss text-cream font-bold text-base sm:text-lg active:scale-95 transition disabled:opacity-40 disabled:active:scale-100">
            {t("session.start")}
          </button>
          <div class="text-xs text-cream/40">{t("session.ready")}</div>
        {:else if liveState === "connecting"}
          <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-cream/10 flex items-center justify-center">
            <div class="text-cream/60">…</div>
          </div>
          <div class="text-xs text-cream/40">{t("session.connecting")}</div>
        {:else if liveState === "connected"}
          <button onclick={end} class="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-cream text-ink font-bold active:scale-95 transition">
            {t("session.stop")}
          </button>
          <div class="text-xs text-cream/40">{t("session.live")}</div>
        {:else if liveState === "ending"}
          <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-cream/20 flex items-center justify-center text-cream/60">
            …
          </div>
          <div class="text-xs text-cream/40">{t("session.preparing")}</div>
        {/if}
      </div>

      <!-- RIGHT: CEFR level (A1 / B1 / native). Default C, sent as a no-turn context prompt -->
      <div class="flex flex-col items-center gap-1.5">
        <div class="flex items-center gap-1 sm:gap-2">
          {#each ["A", "B", "C"] as L}
            <button
              type="button"
              onclick={() => setLevel(L as Level)}
              aria-pressed={level === L}
              class="w-9 h-9 sm:w-11 sm:h-11 rounded-full text-xs sm:text-sm font-mono flex items-center justify-center transition
                {level === L ? 'bg-cream text-ink' : 'bg-transparent text-cream/60 border border-cream/20 hover:text-cream hover:border-cream/40'}"
            >
              {L}
            </button>
          {/each}
        </div>
        <div class="text-[10px] uppercase tracking-widest text-cream/30">level</div>
      </div>
    </div>
  </footer>
</main>

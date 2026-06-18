// Ported from maredan/maredan_ui/src/lib/gemini-live.ts
// Talks to the rede Cloudflare Worker WebSocket proxy.

import { config } from "./config";
import { getDeviceId } from "./device";
import { addKnowledgeItem } from "./knowledge";

export type SessionState = "idle" | "connecting" | "connected" | "ending" | "error";

export interface Feedback {
  said: string;
  correction: string;
  why: string;
}

export interface GeminiLiveCallbacks {
  onStateChange?: (state: SessionState) => void;
  onTranscript?: (text: string, role: "user" | "model") => void;
  onAiTurnEnd?: (aiTurnIdx: number) => void;
  onFeedback?: (feedback: Feedback[]) => void;
  onError?: (message: string) => void;
  onSessionId?: (id: string) => void;
}

export class GeminiLiveSession {
  private ws: WebSocket | null = null;
  private captureCtx: AudioContext | null = null;
  private captureWorklet: AudioWorkletNode | null = null;
  private mediaStream: MediaStream | null = null;
  private playbackCtx: AudioContext | null = null;
  private playbackWorklet: AudioWorkletNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private callbacks: GeminiLiveCallbacks;
  private visibilityHandler: (() => void) | null = null;

  // Per-AI-turn PCM chunk capture for replay. Each entry is one AI turn's
  // worth of Float32 samples at 24 kHz mono. Turn boundaries are inferred
  // from transcript role flips: a new AI turn starts when a model-role
  // transcript arrives after a user-role one (or at session start).
  private aiTurns: Float32Array[][] = [];
  private currentAiTurnIdx = -1;
  private lastTranscriptRole: "user" | "model" | null = null;

  // Per-USER-turn PCM chunk capture so the UI can replay the actual mic audio
  // (Gemini's input transcription mishears Mundart often enough that the raw
  // wav is the only authoritative record). Captured at 16 kHz mono, what we
  // already feed the worker. Turn boundary == when transcript role flips to
  // "user" after the model, OR at session start.
  //
  // Mic frames go into `pendingUserAudio` first, then get claimed by the
  // current user turn on the next transcript event. This decouples capture
  // (which starts the moment the mic opens) from transcript echo (which
  // arrives seconds later from Gemini). Without this, the leading 1-3 seconds
  // of every user utterance get dropped on the floor.
  private userTurns: Float32Array[][] = [];
  private currentUserTurnIdx = -1;
  private pendingUserAudio: Float32Array[] = [];

  state: SessionState = "idle";

  constructor(callbacks: GeminiLiveCallbacks = {}) {
    this.callbacks = callbacks;
  }

  async start(dialect: string, scenario: string, token?: string | null, sessionId?: string, newsContext?: { title: string; body: string }, knowledge?: string[], level?: "A" | "B" | "C") {
    this.setState("connecting");
    // Reset per-session replay buffers
    this.aiTurns = [];
    this.currentAiTurnIdx = -1;
    this.userTurns = [];
    this.currentUserTurnIdx = -1;
    this.pendingUserAudio = [];
    this.lastTranscriptRole = null;
    try {
      await this.startPlayback();
      await this.openSocket(dialect, scenario, token ?? null, sessionId, newsContext, knowledge, level);
      await this.startCapture();
      this.attachVisibilityHandler();
      this.setState("connected");
    } catch (err: any) {
      this.setState("error");
      this.callbacks.onError?.(err?.message ?? String(err));
      this.cleanup();
    }
  }

  stop() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.setState("ending");
      this.ws.send(JSON.stringify({ type: "stop" }));
    } else {
      this.cleanup();
      this.setState("idle");
    }
  }

  // Inject text into the conversation without making the AI take a turn —
  // used for switching difficulty level, pushing user-profile context, etc.
  sendContext(text: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "context", text }));
    }
  }

  // Set the live playback speed. Worklet uses SoundTouch tempo for proper
  // pitch-preserved time-stretching. 1.0 = native, 0.5 = half speed, same pitch.
  setLiveSpeed(speed: number) {
    this.playbackWorklet?.port.postMessage({ type: "speed", value: speed });
  }

  forceClose() {
    this.cleanup();
    this.setState("idle");
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private openSocket(dialect: string, scenario: string, token?: string | null, sessionId?: string, newsContext?: { title: string; body: string }, knowledge?: string[], level?: "A" | "B" | "C"): Promise<void> {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams();
      if (token) params.set("token", token);
      params.set("device", getDeviceId());
      const url = `${config.workerWsUrl}/ws/live?${params.toString()}`;
      this.ws = new WebSocket(url);
      this.ws.binaryType = "arraybuffer";

      this.ws.onopen = () => {
        this.ws!.send(JSON.stringify({ type: "start", dialect, scenario, sessionId, newsContext, knowledge, level }));
      };

      this.ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          this.playAudio(event.data);
          return;
        }
        let msg: any;
        try { msg = JSON.parse(event.data as string); } catch { return; }
        switch (msg.type) {
          case "ready":
            resolve();
            break;
          case "session_id":
            this.callbacks.onSessionId?.(msg.id);
            break;
          case "transcript":
            this.trackTurnBoundary(msg.role);
            this.callbacks.onTranscript?.(msg.text, msg.role);
            break;
          case "interrupted":
            this.playbackWorklet?.port.postMessage("interrupt");
            break;
          case "ai_turn_end":
            // Gemini finished generating this AI response. The whole turn is
            // now in `aiTurns[currentAiTurnIdx]` and can be played as a WAV.
            if (this.currentAiTurnIdx >= 0) {
              this.callbacks.onAiTurnEnd?.(this.currentAiTurnIdx);
            }
            break;
          case "feedback":
            this.callbacks.onFeedback?.(msg.feedback ?? []);
            break;
          case "tool_call":
            if (msg.name === "remember_detail" && msg.args?.text) {
              addKnowledgeItem(msg.args.text);
              this.ws?.send(JSON.stringify({ type: "tool_response", callId: msg.callId, result: "Saved" }));
            }
            break;
          case "error":
            this.callbacks.onError?.(msg.message ?? "unknown error");
            reject(new Error(msg.message ?? "unknown error"));
            break;
        }
      };

      this.ws.onerror = () => reject(new Error("WebSocket connection failed"));
      this.ws.onclose = () => {
        if (this.state !== "idle") {
          this.cleanup();
          this.setState("idle");
        }
      };
    });
  }

  private async startPlayback() {
    this.playbackCtx = new AudioContext({ sampleRate: 24000 });
    await this.playbackCtx.audioWorklet.addModule("/audio-processors/playback.worklet.js?v=7");
    this.playbackWorklet = new AudioWorkletNode(this.playbackCtx, "pcm-playback-processor");
    this.playbackWorklet.connect(this.playbackCtx.destination);
  }

  private async startCapture() {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    console.log("[gemini-live] mic stream tracks:", this.mediaStream.getAudioTracks().map((t) => ({ label: t.label, enabled: t.enabled, muted: t.muted, readyState: t.readyState })));
    this.captureCtx = new AudioContext({ sampleRate: 16000 });
    if (this.captureCtx.state === "suspended") {
      await this.captureCtx.resume();
    }
    console.log("[gemini-live] capture ctx state:", this.captureCtx.state, "sample rate:", this.captureCtx.sampleRate);
    await this.captureCtx.audioWorklet.addModule("/audio-processors/capture.worklet.js");
    this.captureWorklet = new AudioWorkletNode(this.captureCtx, "audio-capture-processor");

    let framesSent = 0;
    this.captureWorklet.port.onmessage = (e) => {
      if (e.data?.type === "audio" && this.ws?.readyState === WebSocket.OPEN) {
        framesSent++;
        if (framesSent === 1) console.log("[gemini-live] first audio frame sent to worker");
        if (framesSent % 100 === 0) console.log(`[gemini-live] ${framesSent} frames sent`);
        // Forward to the worker as before…
        this.ws.send(pcm16(e.data.data));
        // …and buffer for local replay. Frames go into `pendingUserAudio`
        // until the next transcript event tells us which turn they belong to.
        // (We can't push directly into userTurns[currentUserTurnIdx] because
        // Gemini's user transcript echo arrives seconds late, so the first
        // frames of every utterance would be lost.)
        this.pendingUserAudio.push(new Float32Array(e.data.data));
      }
    };

    const src = this.captureCtx.createMediaStreamSource(this.mediaStream);
    this.analyserNode = this.captureCtx.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.92;
    src.connect(this.analyserNode);
    src.connect(this.captureWorklet);
    console.log("[gemini-live] capture pipeline connected");
  }

  // Two parallel sinks for each incoming PCM chunk:
  //   1. Worklet playback at 1× (real-time live audio, no delay).
  //   2. Per-turn buffer (so the user can tap to replay later at chosen
  //      speed via HTMLAudioElement with preservesPitch).
  private async playAudio(buffer: ArrayBuffer) {
    if (!this.playbackCtx || !this.playbackWorklet) return;
    if (this.playbackCtx.state === "suspended") await this.playbackCtx.resume();
    const int16 = new Int16Array(buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
    // (1) live, real-time
    this.playbackWorklet.port.postMessage(float32);
    // (2) replay buffer
    if (this.currentAiTurnIdx >= 0 && this.aiTurns[this.currentAiTurnIdx]) {
      this.aiTurns[this.currentAiTurnIdx].push(float32);
    }
  }

  // Transcript role flips drive both AI and user turn boundaries.
  //
  // For the user side: any mic frames captured since the last event are
  // buffered in `pendingUserAudio`. We claim them at the right boundary:
  //   - new user turn  → start a fresh userTurns[N], hand pending to it
  //   - user continues → drain pending into current userTurns[N]
  //   - model takes over → drain pending into the just-finished user turn
  //     (it's tail-end user speech Gemini hasn't transcribed yet),
  //     then any future mic frames go into pending until next user turn.
  private trackTurnBoundary(role: "user" | "model") {
    if (role === "user" && this.lastTranscriptRole !== "user") {
      // New user turn. Claim the pending buffer for it.
      this.currentUserTurnIdx++;
      this.userTurns.push(this.pendingUserAudio);
      this.pendingUserAudio = [];
    } else if (role === "user") {
      // Continuation. Drain pending into current turn.
      if (this.currentUserTurnIdx >= 0 && this.pendingUserAudio.length) {
        const cur = this.userTurns[this.currentUserTurnIdx];
        for (const c of this.pendingUserAudio) cur.push(c);
        this.pendingUserAudio = [];
      }
    }
    if (role === "model" && this.lastTranscriptRole !== "model") {
      this.currentAiTurnIdx++;
      this.aiTurns.push([]);
      // Tail-end of user speech (Gemini hasn't transcribed it yet) belongs
      // to the user turn that just finished, not to the upcoming silence.
      if (this.currentUserTurnIdx >= 0 && this.pendingUserAudio.length) {
        const cur = this.userTurns[this.currentUserTurnIdx];
        for (const c of this.pendingUserAudio) cur.push(c);
      }
      this.pendingUserAudio = [];
    }
    this.lastTranscriptRole = role;
  }

  // Build a WAV blob for AI turn `idx`. Returns null if no audio captured yet.
  // Output: 24 kHz mono 16-bit PCM (the rate Gemini ships).
  getTurnAudioBlob(idx: number): Blob | null {
    const chunks = this.aiTurns[idx];
    if (!chunks || chunks.length === 0) return null;
    const total = chunks.reduce((n, c) => n + c.length, 0);
    if (total === 0) return null;
    return pcmToWavBlob(chunks, 24000);
  }

  // Build a WAV blob for the user's turn `idx`. Same idea as above but at
  // 16 kHz (the mic capture rate). Leading and trailing silence is trimmed
  // so playback doesn't sound blank when there's only a short utterance.
  getUserTurnAudioBlob(idx: number): Blob | null {
    const chunks = this.userTurns[idx];
    if (!chunks || chunks.length === 0) return null;
    const total = chunks.reduce((n, c) => n + c.length, 0);
    if (total === 0) return null;
    const trimmed = trimSilence(chunks, 16000);
    if (!trimmed || trimmed.length === 0) return null;
    return pcmToWavBlob([trimmed], 16000);
  }

  userTurnCount(): number {
    return this.userTurns.length;
  }

  // Drain any unclaimed mic audio into the most recent user turn. Call this
  // before reading user-turn blobs for persistence: at session end Gemini may
  // not have echoed the last user transcript yet, leaving tail audio orphaned
  // in `pendingUserAudio`.
  flushPendingUserAudio(): void {
    if (this.pendingUserAudio.length === 0) return;
    if (this.currentUserTurnIdx >= 0) {
      const cur = this.userTurns[this.currentUserTurnIdx];
      for (const c of this.pendingUserAudio) cur.push(c);
    }
    this.pendingUserAudio = [];
  }

  private attachVisibilityHandler() {
    this.visibilityHandler = async () => {
      if (document.visibilityState === "visible") {
        try { await this.playbackCtx?.resume(); } catch { /* ignore */ }
        try { await this.captureCtx?.resume(); } catch { /* ignore */ }
      }
    };
    document.addEventListener("visibilitychange", this.visibilityHandler);
  }

  private cleanup() {
    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
    try { this.ws?.close(); } catch { /* ignore */ }
    this.ws = null;
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;
    try { this.captureCtx?.close(); } catch { /* ignore */ }
    this.captureCtx = null;
    try { this.playbackCtx?.close(); } catch { /* ignore */ }
    this.playbackCtx = null;
    this.captureWorklet = null;
    this.playbackWorklet = null;
    this.analyserNode = null;
  }

  private setState(s: SessionState) {
    this.state = s;
    this.callbacks.onStateChange?.(s);
  }
}

function pcm16(float32: Float32Array): ArrayBuffer {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16.buffer;
}

// Trim leading and trailing silence from a chunked mic recording. Mic
// capture is always running, so the user often has 1-3s of silence at the
// start (before they spoke) and a long tail (after they stopped, while
// Gemini was still transcribing). Returns one concatenated Float32Array,
// or null if everything was silent.
//
// Algorithm: walk 20 ms windows, mark a window "voiced" if peak |sample|
// crosses a threshold. Take from first voiced to last voiced, plus a small
// padding so the audio doesn't sound clipped.
function trimSilence(chunks: Float32Array[], sampleRate: number): Float32Array | null {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  if (total === 0) return null;
  // Flatten to one buffer so we can slice cheaply.
  const flat = new Float32Array(total);
  let off = 0;
  for (const c of chunks) { flat.set(c, off); off += c.length; }

  const windowMs = 20;
  const win = Math.max(1, Math.round((sampleRate * windowMs) / 1000)); // 320 samples @ 16k
  const threshold = 0.02; // peak amplitude above this counts as voice
  const padMs = 80;        // breathe a little around the edges
  const pad = Math.round((sampleRate * padMs) / 1000);

  // Find first voiced window
  let firstVoiced = -1;
  for (let i = 0; i < flat.length; i += win) {
    let peak = 0;
    const end = Math.min(i + win, flat.length);
    for (let j = i; j < end; j++) {
      const a = flat[j] < 0 ? -flat[j] : flat[j];
      if (a > peak) peak = a;
    }
    if (peak >= threshold) { firstVoiced = i; break; }
  }
  if (firstVoiced < 0) return null; // entirely silent

  // Find last voiced window
  let lastVoiced = firstVoiced;
  for (let i = flat.length - win; i >= 0; i -= win) {
    let peak = 0;
    const end = Math.min(i + win, flat.length);
    for (let j = i; j < end; j++) {
      const a = flat[j] < 0 ? -flat[j] : flat[j];
      if (a > peak) peak = a;
    }
    if (peak >= threshold) { lastVoiced = Math.min(end, flat.length); break; }
  }

  const start = Math.max(0, firstVoiced - pad);
  const stop = Math.min(flat.length, lastVoiced + pad);
  return flat.subarray(start, stop);
}

// Concatenate Float32 chunks and wrap as a mono 16-bit PCM WAV blob playable
// by HTMLAudioElement (which supports `playbackRate` + `preservesPitch`).
function pcmToWavBlob(chunks: Float32Array[], sampleRate: number): Blob {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const pcm = new Int16Array(total);
  let offset = 0;
  for (const c of chunks) {
    for (let i = 0; i < c.length; i++) {
      const s = Math.max(-1, Math.min(1, c[i]));
      pcm[offset++] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
  }
  const dataSize = pcm.byteLength;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);
  // RIFF header
  writeStr(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(view, 8, "WAVE");
  // fmt chunk
  writeStr(view, 12, "fmt ");
  view.setUint32(16, 16, true);            // chunk size
  view.setUint16(20, 1, true);             // PCM
  view.setUint16(22, 1, true);             // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);// byte rate
  view.setUint16(32, 2, true);             // block align
  view.setUint16(34, 16, true);            // bits per sample
  // data chunk
  writeStr(view, 36, "data");
  view.setUint32(40, dataSize, true);
  new Int16Array(buf, 44).set(pcm);
  return new Blob([buf], { type: "audio/wav" });
}

function writeStr(view: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}

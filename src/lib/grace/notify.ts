import { toast, type ExternalToast } from "sonner";

export const GRACE_TOASTER_ID = "grace";

function withToaster(data?: ExternalToast): ExternalToast {
  return { toasterId: GRACE_TOASTER_ID, ...data };
}

export const graceToast = {
  success: (message: string, data?: ExternalToast) => toast.success(message, withToaster(data)),
  warning: (message: string, data?: ExternalToast) => toast.warning(message, withToaster(data)),
  error: (message: string, data?: ExternalToast) => toast.error(message, withToaster(data)),
};

type AudioCtxCtor = typeof AudioContext;

let chime: HTMLAudioElement | null = null;
let audioCtx: AudioContext | null = null;
let primeToken = 0;

function audioContextCtor(): AudioCtxCtor | null {
  if (typeof window === "undefined") return null;
  return window.AudioContext || (window as typeof window & { webkitAudioContext?: AudioCtxCtor }).webkitAudioContext || null;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const n = samples.length;
  const bytes = new ArrayBuffer(44 + n * 2);
  const view = new DataView(bytes);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + n * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, n * 2, true);
  let offset = 44;
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([bytes], { type: "audio/wav" });
}

function chimeWavUrl(): string {
  const sr = 44100;
  const n = Math.floor(sr * 0.62);
  const samples = new Float32Array(n);
  const notes = [
    { freq: 880, start: 0, end: 0.22 },
    { freq: 1174.66, start: 0.14, end: 0.56 },
  ];
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let mix = 0;
    for (const note of notes) {
      if (t < note.start || t >= note.end) continue;
      const u = (t - note.start) / (note.end - note.start);
      const env = Math.sin(Math.PI * Math.min(1, u)) * Math.exp(-2.4 * u);
      mix += Math.sin(2 * Math.PI * note.freq * t) * env;
    }
    samples[i] = mix * 0.72;
  }
  return URL.createObjectURL(encodeWav(samples, sr));
}

function getCtx(): AudioContext | null {
  const Ctor = audioContextCtor();
  if (!Ctor) return null;
  if (!audioCtx || audioCtx.state === "closed") audioCtx = new Ctor();
  return audioCtx;
}

function playOscillatorChime(ctx: AudioContext) {
  const now = ctx.currentTime;
  const notes = [
    { freq: 880, at: 0, dur: 0.2 },
    { freq: 1174.66, at: 0.14, dur: 0.32 },
  ];
  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = note.freq;
    const t = now + note.at;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + note.dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + note.dur + 0.02);
  }
}

function ensureChime(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (chime) return chime;
  chime = new Audio(chimeWavUrl());
  chime.preload = "auto";
  chime.volume = 0.85;
  chime.setAttribute("playsinline", "");
  chime.style.display = "none";
  document.body.appendChild(chime);
  return chime;
}

/** Call from the Pull click so the browser allows sound after the scrape. */
export function unlockPullChime() {
  if (typeof window === "undefined") return;
  const token = ++primeToken;
  const el = ensureChime();
  if (el) {
    el.muted = true;
    el.volume = 0;
    el.currentTime = 0;
    void el.play()?.then(() => {
      if (token !== primeToken) return;
      el.pause();
      el.currentTime = 0;
      el.muted = false;
      el.volume = 0.85;
    }).catch(() => {
      if (token !== primeToken) return;
      el.muted = false;
      el.volume = 0.85;
    });
  }
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

/** Done chime — needs unlockPullChime() on the same user click that started the pull. */
export function playPullDoneChime() {
  if (typeof window === "undefined") return;
  primeToken += 1;
  const el = ensureChime();
  if (el) {
    el.muted = false;
    el.volume = 0.85;
    try {
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
    const played = el.play();
    if (played) {
      void played.catch(() => {
        const ctx = getCtx();
        if (!ctx) return;
        void ctx.resume().then(() => playOscillatorChime(ctx)).catch(() => {});
      });
      return;
    }
  }
  const ctx = getCtx();
  if (!ctx) return;
  void ctx.resume().then(() => playOscillatorChime(ctx)).catch(() => {});
}
"use client";

/**
 * Short rising three-note chime, synthesised with Web Audio so no asset is
 * needed. Plays twice so it's noticed from another tab.
 */
export function playResearchAlertChime(): void {
  if (typeof window === "undefined") return;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return;
  let ctx: AudioContext;
  try {
    ctx = new Ctx();
  } catch {
    return;
  }
  const play = () => {
    const notes = [880, 1108.73, 1318.51];
    const base = ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = base + i * 0.16;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.6);
    });
  };
  const run = () => {
    play();
    window.setTimeout(play, 1100);
    window.setTimeout(() => void ctx.close().catch(() => {}), 3000);
  };
  if (ctx.state === "suspended") {
    void ctx.resume().then(run, run);
  } else {
    run();
  }
}

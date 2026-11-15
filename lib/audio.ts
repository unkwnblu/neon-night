/**
 * A small synthesised club loop, so the page has sound without needing a
 * licensed track. It starts muffled, as if heard through the wall, and the
 * low-pass filter opens as the visitor walks towards the dance floor.
 */
export const BPM = 128;
const STEP = 60 / BPM / 4;
const ROOTS = [55, 55, 43.65, 49];
const BASS_STEPS = new Set([2, 3, 6, 7, 10, 11, 14]);
const LEVEL = 0.5;
/**
 * How far ahead notes are queued. Generous on purpose: switching the lights on
 * and walking into the hall both make the page briefly busy, and a short queue
 * would run dry and leave a hole in the beat.
 */
const LOOKAHEAD = 0.6;

type Engine = {
  ctx: AudioContext;
  master: GainNode;
  filter: BiquadFilterNode;
  noise: AudioBuffer;
  step: number;
  nextTime: number;
  origin: number;
  /** True once the loop has been given its start time. */
  begun: boolean;
  /** Steps that were never played because the scheduler ran late. */
  dropped: number;
  /** Stops the timer, removes listeners and closes the audio context. */
  dispose: () => void;
};

// Kept on globalThis so a hot reload in development reuses the one engine
// instead of leaving the old loop playing underneath a new one.
const state = ((globalThis as unknown as { __neonNightAudio?: { engine: Engine | null; muted: boolean } })
  .__neonNightAudio ??= { engine: null, muted: false });

function burst(e: Engine, t: number, type: BiquadFilterType, freq: number, level: number, dur: number, out: AudioNode) {
  const { ctx } = e;
  const src = ctx.createBufferSource();
  src.buffer = e.noise;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 0.5, dur + 0.02);
}

function kick({ ctx, filter }: Engine, t: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(1, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
  o.connect(g).connect(filter);
  o.start(t);
  o.stop(t + 0.36);
}

function bass({ ctx, filter }: Engine, t: number, freq: number) {
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.value = freq;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(700, t);
  f.frequency.exponentialRampToValueAtTime(180, t + STEP);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + STEP * 0.95);
  o.connect(f).connect(g).connect(filter);
  o.start(t);
  o.stop(t + STEP);
}

function schedule(e: Engine) {
  const { ctx } = e;
  if (!e.begun || ctx.state !== "running") return;
  if (e.nextTime < ctx.currentTime) {
    // Fell behind (tab was in the background): skip ahead on the beat grid.
    const missed = Math.ceil((ctx.currentTime + 0.05 - e.nextTime) / STEP);
    e.nextTime += missed * STEP;
    e.step += missed;
    e.dropped += missed;
  }
  while (e.nextTime < ctx.currentTime + LOOKAHEAD) {
    const s = e.step % 16;
    if (s % 4 === 0) kick(e, e.nextTime);
    if (s % 4 === 2) burst(e, e.nextTime, "highpass", 8000, 0.16, 0.05, e.filter);
    if (s === 4 || s === 12) burst(e, e.nextTime, "bandpass", 1500, 0.32, 0.14, e.filter);
    if (BASS_STEPS.has(s)) bass(e, e.nextTime, ROOTS[Math.floor(e.step / 16) % ROOTS.length]);
    e.nextTime += STEP;
    e.step++;
  }
}

/** The crackle of a neon tube catching, played once at switch-on. */
function zap(e: Engine, t: number) {
  const { ctx, master } = e;
  for (const [at, dur] of [[0, 0.05], [0.09, 0.04], [0.24, 0.09], [0.52, 0.06]]) {
    burst(e, t + at, "bandpass", 3200, 0.22, dur, master);
  }
  const hum = ctx.createOscillator();
  hum.type = "sawtooth";
  // A2: in key with the bass line it plays over. A mains-style 100Hz hum clashed with it.
  hum.frequency.value = 110;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
  hum.connect(g).connect(master);
  hum.start(t);
  hum.stop(t + 2.7);
}

/** Starts the crackle and the first kick together, timed off the audio clock. */
function begin(e: Engine) {
  if (e.begun || e.ctx.state !== "running") return;
  e.begun = true;
  // A short lead so nothing is clipped while the output device wakes up.
  const t = e.ctx.currentTime + 0.06;
  zap(e, t);
  e.origin = e.nextTime = t;
  schedule(e);
}

function build(): Engine | null {
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  // iPhones mute web audio when the ring/silent switch is on silent unless the
  // page declares itself as media playback, the way a music or video site does.
  const session = (navigator as { audioSession?: { type: string } }).audioSession;
  if (session) session.type = "playback";
  const ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = state.muted ? 0 : LEVEL;
  master.connect(ctx.destination);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 160;
  filter.Q.value = 0.9;
  filter.connect(master);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const e: Engine = {
    ctx, master, filter, noise, step: 0, nextTime: 0, origin: 0, begun: false, dropped: 0,
    dispose: () => undefined,
  };

  const timer = window.setInterval(() => schedule(e), 40);

  // Browsers can leave the context suspended (first load, returning to the
  // tab, a phone call). Any later tap or key press wakes it and, if the loop
  // never got going, starts it then.
  const wake = () => {
    if (document.hidden) return;
    if (ctx.state === "running") begin(e);
    else void ctx.resume().then(() => begin(e), () => undefined);
  };
  const onVisibility = () => {
    if (document.hidden) void ctx.suspend();
    else wake();
  };
  window.addEventListener("pointerdown", wake);
  window.addEventListener("keydown", wake);
  document.addEventListener("visibilitychange", onVisibility);
  e.dispose = () => {
    window.clearInterval(timer);
    window.removeEventListener("pointerdown", wake);
    window.removeEventListener("keydown", wake);
    document.removeEventListener("visibilitychange", onVisibility);
    void ctx.close().catch(() => undefined);
  };
  return e;
}

/**
 * Call from a tap or click, or the browser will block it. Resolves once sound
 * is actually running, so the caller can fire visuals on the same moment.
 */
export async function startAudio() {
  const e = state.engine ?? (state.engine = build());
  if (!e) return;
  if (e.ctx.state !== "running") {
    try {
      await e.ctx.resume();
    } catch {
      // Still blocked; the wake listeners will retry on the next interaction.
    }
  }
  begin(e);
}

/** Silences everything at once. The next startAudio() begins again from the top. */
export function stopAudio() {
  const e = state.engine;
  state.engine = null;
  if (!e) return;
  // An engine left over from before a hot reload may predate dispose().
  if (typeof e.dispose === "function") e.dispose();
  else void e.ctx.close().catch(() => undefined);
}

export function setMuted(value: boolean) {
  state.muted = value;
  const e = state.engine;
  if (e) e.master.gain.setTargetAtTime(value ? 0 : LEVEL, e.ctx.currentTime, 0.08);
}

/** 0 = outside, hearing it through the wall. 1 = standing on the floor. */
export function setOpenness(amount: number) {
  const e = state.engine;
  if (!e) return;
  const a = Math.min(1, Math.max(0, amount));
  e.filter.frequency.setTargetAtTime(160 * Math.pow(90, a), e.ctx.currentTime, 0.12);
}

/** Beats elapsed since the loop started, or null when no audio is running. */
export function beatClock() {
  const e = state.engine;
  if (!e || !e.begun || e.ctx.state !== "running" || e.ctx.currentTime < e.origin) return null;
  return ((e.ctx.currentTime - e.origin) * BPM) / 60;
}

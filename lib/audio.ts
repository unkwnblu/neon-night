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

let ctx: AudioContext | null = null;
let master: GainNode;
let filter: BiquadFilterNode;
let noise: AudioBuffer;
let step = 0;
let nextTime = 0;
let origin = 0;
let muted = false;

function burst(t: number, type: BiquadFilterType, freq: number, level: number, dur: number, out: AudioNode) {
  if (!ctx) return;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 0.5, dur + 0.02);
}

function kick(t: number) {
  if (!ctx) return;
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

function bass(t: number, freq: number) {
  if (!ctx) return;
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

function schedule() {
  if (!ctx || ctx.state !== "running") return;
  if (nextTime < ctx.currentTime) {
    // Fell behind (tab was in the background): skip ahead on the beat grid.
    const missed = Math.ceil((ctx.currentTime + 0.05 - nextTime) / STEP);
    nextTime += missed * STEP;
    step += missed;
  }
  while (nextTime < ctx.currentTime + 0.15) {
    const s = step % 16;
    if (s % 4 === 0) kick(nextTime);
    if (s % 4 === 2) burst(nextTime, "highpass", 8000, 0.16, 0.05, filter);
    if (s === 4 || s === 12) burst(nextTime, "bandpass", 1500, 0.32, 0.14, filter);
    if (BASS_STEPS.has(s)) bass(nextTime, ROOTS[Math.floor(step / 16) % ROOTS.length]);
    nextTime += STEP;
    step++;
  }
}

/** The crackle of a neon tube catching, played once at switch-on. */
function zap(t: number) {
  if (!ctx) return;
  for (const [at, dur] of [[0, 0.05], [0.09, 0.04], [0.24, 0.09], [0.52, 0.06]]) {
    burst(t + at, "bandpass", 3200, 0.22, dur, master);
  }
  const hum = ctx.createOscillator();
  hum.type = "sawtooth";
  hum.frequency.value = 100;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
  hum.connect(g).connect(master);
  hum.start(t);
  hum.stop(t + 2.7);
}

/** Must be called from a tap or click, or the browser will block it. */
export function startAudio() {
  if (ctx) return;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : LEVEL;
  master.connect(ctx.destination);
  filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 160;
  filter.Q.value = 0.9;
  filter.connect(master);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  zap(ctx.currentTime + 0.02);
  origin = nextTime = ctx.currentTime + 0.9;
  window.setInterval(schedule, 40);
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else void ctx.resume();
  });
}

export function setMuted(value: boolean) {
  muted = value;
  if (ctx) master.gain.setTargetAtTime(value ? 0 : LEVEL, ctx.currentTime, 0.08);
}

/** 0 = outside, hearing it through the wall. 1 = standing on the floor. */
export function setOpenness(amount: number) {
  if (!ctx) return;
  const a = Math.min(1, Math.max(0, amount));
  filter.frequency.setTargetAtTime(160 * Math.pow(90, a), ctx.currentTime, 0.12);
}

/** Beats elapsed since the loop started, or null when no audio is running. */
export function beatClock() {
  if (!ctx || ctx.state !== "running" || ctx.currentTime < origin) return null;
  return ((ctx.currentTime - origin) * BPM) / 60;
}

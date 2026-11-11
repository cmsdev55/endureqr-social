/**
 * Original background music for the reels, synthesised from scratch (no samples, no third-party tracks),
 * so Instagram and Facebook can never mute a reel for copyright.
 *
 *   import { makeTrack, moodFor } from "./music.mjs";
 *   const wav = makeTrack({ mood: "upbeat", seconds: 13.3, seed: 2, transitions: [3.45, 6.65] });
 *
 * Moods: "upbeat" (pop pluck, kick/clap/hats), "calm" (pads and soft bells), "tense" (minor pulse, ticking).
 * `seed` changes key, tempo, chord progression and arpeggio, so each reel sounds different.
 * `transitions` adds a soft whoosh at each slide change. Returns a 16-bit stereo WAV Buffer.
 */
const SR = 44100;

export function moodFor(soundText = "") {
  const s = soundText.toLowerCase();
  if (s.includes("suspense") || s.includes("tense")) return "tense";
  if (s.includes("calm")) return "calm";
  return "upbeat";
}

function rng(seed) {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const MOODS = {
  upbeat: { scale: "major", bpm: [112, 122], roots: [60, 62, 57, 64, 59], progs: [[0, 4, 5, 3], [5, 3, 0, 4], [0, 5, 3, 4], [3, 0, 4, 5]], sevenths: false },
  calm: { scale: "major", bpm: [82, 92], roots: [60, 65, 62, 57], progs: [[3, 2, 1, 0], [0, 5, 3, 4], [0, 3, 5, 4]], sevenths: true },
  tense: { scale: "minor", bpm: [96, 104], roots: [57, 52, 55], progs: [[0, 5, 2, 6], [0, 6, 5, 4], [0, 3, 5, 4]], sevenths: false },
};

export function makeTrack({ mood = "upbeat", seconds, seed = 1, transitions = [] }) {
  const M = MOODS[mood] || MOODS.upbeat;
  const r = rng(seed);
  const bpm = M.bpm[0] + Math.floor(r() * (M.bpm[1] - M.bpm[0]));
  const beat = 60 / bpm, bar = beat * 4;
  const root = pick(r, M.roots);
  const prog = pick(r, M.progs);
  const scale = SCALES[M.scale];
  const n = Math.ceil(seconds * SR) + SR; // 1 s tail for reverb, trimmed later
  const L = new Float32Array(n), R = new Float32Array(n); // dry
  const SL = new Float32Array(n), SRr = new Float32Array(n); // reverb send

  const note = (deg, oct = 0) => root + 12 * (oct + Math.floor(deg / 7)) + scale[((deg % 7) + 7) % 7];
  const chord = (d) => (M.sevenths ? [d, d + 2, d + 4, d + 6] : [d, d + 2, d + 4]).map((x) => note(x));

  // ── instruments: each writes into the buffers for its own sample range only
  const add = (i, l, rr, send) => {
    if (i < 0 || i >= n) return;
    L[i] += l; R[i] += rr;
    if (send) { SL[i] += l * send; SRr[i] += rr * send; }
  };
  function pad(f, t0, dur, g) {
    const a = 0.35, rel = 0.6, s0 = Math.floor(t0 * SR), s1 = Math.floor((t0 + dur + rel) * SR);
    const harm = [1, 0.45, 0.2, 0.1];
    for (let i = s0; i < s1; i++) {
      const t = (i - s0) / SR;
      const env = Math.min(1, t / a) * (t > dur ? Math.max(0, 1 - (t - dur) / rel) : 1);
      let l = 0, rr = 0;
      for (let h = 0; h < harm.length; h++) {
        l += harm[h] * Math.sin(2 * Math.PI * f * (h + 1) * 0.998 * t);
        rr += harm[h] * Math.sin(2 * Math.PI * f * (h + 1) * 1.002 * t + 0.7);
      }
      add(i, l * env * g, rr * env * g, 0.5);
    }
  }
  function pluck(f, t0, g, decay, pan) {
    const s0 = Math.floor(t0 * SR), s1 = s0 + Math.floor(decay * 5 * SR);
    for (let i = s0; i < s1; i++) {
      const t = (i - s0) / SR, env = Math.min(1, t / 0.004) * Math.exp(-t / decay);
      const v = (Math.sin(2 * Math.PI * f * t) + 0.45 * Math.sin(4 * Math.PI * f * t) + 0.15 * Math.sin(6 * Math.PI * f * t)) * env * g;
      add(i, v * (1 - pan), v * (1 + pan), 0.35);
    }
  }
  function bell(f, t0, g, pan) {
    const s0 = Math.floor(t0 * SR), s1 = s0 + Math.floor(3 * SR);
    for (let i = s0; i < s1; i++) {
      const t = (i - s0) / SR, env = Math.min(1, t / 0.006) * Math.exp(-t / 0.9);
      const v = (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t / 0.3) + 0.15 * Math.sin(2 * Math.PI * f * 5.4 * t) * Math.exp(-t / 0.15)) * env * g;
      add(i, v * (1 - pan), v * (1 + pan), 0.6);
    }
  }
  function bassNote(f, t0, dur, g) {
    const s0 = Math.floor(t0 * SR), s1 = Math.floor((t0 + dur) * SR);
    for (let i = s0; i < s1; i++) {
      const t = (i - s0) / SR, left = (s1 - i) / SR;
      const env = Math.min(1, t / 0.01) * Math.min(1, left / 0.04) * (0.6 + 0.4 * Math.exp(-t / 0.15));
      const v = Math.tanh(1.6 * (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(4 * Math.PI * f * t))) * env * g;
      add(i, v, v, 0);
    }
  }
  function kick(t0, g) {
    const s0 = Math.floor(t0 * SR), s1 = s0 + Math.floor(0.45 * SR);
    let ph = 0;
    for (let i = s0; i < s1; i++) {
      const t = (i - s0) / SR, f = 45 + 75 * Math.exp(-t / 0.03);
      ph += (2 * Math.PI * f) / SR;
      const v = Math.sin(ph) * Math.exp(-t / 0.16) * g;
      add(i, v, v, 0);
    }
  }
  let noiseState = 0;
  const noise = () => r() * 2 - 1;
  function clap(t0, g) {
    const s0 = Math.floor(t0 * SR), s1 = s0 + Math.floor(0.25 * SR);
    let lp = 0;
    for (let i = s0; i < s1; i++) {
      const t = (i - s0) / SR, x = noise();
      lp += 0.35 * (x - lp);
      const hp = x - lp; // crude band: remove lows
      const env = Math.exp(-t / 0.07) * (t < 0.012 ? 0.6 + 0.4 * Math.sin(t * 900) : 1);
      const v = hp * env * g;
      add(i, v * 0.9, v, 0.5);
    }
  }
  function hat(t0, g, pan) {
    const s0 = Math.floor(t0 * SR), s1 = s0 + Math.floor(0.06 * SR);
    for (let i = s0; i < s1; i++) {
      const t = (i - s0) / SR, x = noise();
      const hp = x - noiseState; noiseState = x; // first difference = high-pass
      const v = hp * Math.exp(-t / 0.018) * g;
      add(i, v * (1 - pan), v * (1 + pan), 0.1);
    }
  }
  function whoosh(tEnd, g) {
    const len = 0.55, s0 = Math.floor((tEnd - len) * SR), s1 = Math.floor((tEnd + 0.18) * SR);
    let lp = 0;
    for (let i = s0; i < s1; i++) {
      const t = (i - s0) / SR, x = noise();
      const k = 0.02 + 0.5 * Math.min(1, t / len) ** 2; // filter opens as it rises
      lp += k * (x - lp);
      const env = t < len ? (t / len) ** 2 : Math.exp(-(t - len) / 0.05);
      add(i, lp * env * g, lp * env * g * 0.85, 0.7);
    }
  }

  // ── arrangement
  const bars = Math.ceil(seconds / bar) + 1;
  const arp = pick(r, [[0, 1, 2, 1, 0, 2, 1, 2], [0, 2, 1, 2, 0, 1, 2, 1], [2, 1, 0, 1, 2, 0, 1, 0]]);
  for (let b = 0; b < bars; b++) {
    const t = b * bar;
    if (t > seconds) break;
    const deg = prog[b % prog.length];
    const tones = chord(deg);
    const bassF = hz(note(deg, -1)); // ~100–200 Hz: audible on phone speakers
    if (mood === "upbeat") {
      tones.forEach((m) => pad(hz(m), t, bar, 0.04));
      for (let s = 0; s < 8; s++) pluck(hz(tones[arp[s] % tones.length] + 12), t + s * beat / 2, 0.2, 0.18, s % 2 ? 0.35 : -0.35);
      [0, 2].forEach((q) => kick(t + q * beat, 0.28));
      if (b > 0 || r() > 0.5) [1, 3].forEach((q) => clap(t + q * beat, 0.22));
      for (let s = 0; s < 8; s++) if (s % 2) hat(t + s * beat / 2, 0.09, 0.3);
      [0, 1.5, 2.5].forEach((q) => bassNote(bassF, t + q * beat, beat * 0.9, 0.09));
    } else if (mood === "calm") {
      tones.forEach((m) => pad(hz(m), t, bar, 0.05));
      [0, 1.5, 2.5].forEach((q, k) => bell(hz(tones[(k + b) % tones.length] + 12), t + q * beat, 0.1, k % 2 ? 0.3 : -0.3));
      bassNote(bassF, t, bar * 0.95, 0.07);
      for (let s = 0; s < 8; s++) hat(t + s * beat / 2, s % 2 ? 0.035 : 0.02, 0.4);
    } else {
      tones.forEach((m) => pad(hz(m), t, bar, 0.045));
      for (let s = 0; s < 8; s++) bassNote(bassF, t + s * beat / 2, beat * 0.42, 0.08);
      [0, 2].forEach((q) => kick(t + q * beat, 0.26));
      for (let s = 0; s < 16; s++) hat(t + s * beat / 4, s % 4 === 2 ? 0.07 : 0.035, 0.2);
      [0, 3, 6].forEach((s, k) => pluck(hz(tones[(k + b) % tones.length] + 12), t + s * beat / 2, 0.17, 0.24, k % 2 ? 0.4 : -0.4));
    }
  }
  transitions.forEach((tt) => whoosh(tt, 0.05));

  // ── Schroeder reverb on the send bus
  const reverb = (inp, off) => {
    const out = new Float32Array(n);
    const combs = [1557, 1617, 1491, 1422].map((d) => ({ buf: new Float32Array(d + off), i: 0, lp: 0 }));
    const aps = [225, 556, 441, 341].map((d) => ({ buf: new Float32Array(d), i: 0 }));
    for (let s = 0; s < n; s++) {
      let y = 0;
      for (const c of combs) {
        const o = c.buf[c.i];
        c.lp = o * 0.75 + c.lp * 0.25;
        c.buf[c.i] = inp[s] + c.lp * 0.8;
        c.i = (c.i + 1) % c.buf.length;
        y += o;
      }
      y *= 0.25;
      for (const a of aps) {
        const o = a.buf[a.i];
        const v = y + o * 0.5;
        a.buf[a.i] = v;
        a.i = (a.i + 1) % a.buf.length;
        y = o - v * 0.5;
      }
      out[s] = y;
    }
    return out;
  };
  const wl = reverb(SL, 0), wr = reverb(SRr, 23);

  // ── master: mix, fades, level to about -18 dBFS RMS, soft limiter
  const total = Math.floor(seconds * SR);
  const outL = new Float32Array(total), outR = new Float32Array(total);
  let sum = 0;
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    const fade = Math.min(1, t / 0.12) * Math.min(1, (seconds - t) / 1.2);
    outL[i] = (L[i] + wl[i] * 0.9) * fade;
    outR[i] = (R[i] + wr[i] * 0.9) * fade;
    sum += outL[i] ** 2 + outR[i] ** 2;
  }
  const rms = Math.sqrt(sum / (2 * total)) || 1;
  const gain = 0.125 / rms;
  const buf = Buffer.alloc(44 + total * 4);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + total * 4, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(total * 4, 40);
  for (let i = 0; i < total; i++) {
    const l = Math.tanh(outL[i] * gain * 1.1) * 0.89, rr = Math.tanh(outR[i] * gain * 1.1) * 0.89;
    buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(rr * 32767), 46 + i * 4);
  }
  return buf;
}

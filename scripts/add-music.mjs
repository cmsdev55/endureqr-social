#!/usr/bin/env node
/**
 * Puts original background music (scripts/music.mjs) on the reels in media/, replacing the silent track.
 * The video stream is copied untouched; the mood comes from each reel's "sound" in posts.json.
 *
 *   node scripts/add-music.mjs          # every reel
 *   node scripts/add-music.mjs 2 5      # only days 2 and 5
 *
 * Needs ffmpeg/ffprobe on PATH. Safe to run again: it always rebuilds the audio from scratch.
 */
import { readFile, writeFile, rename, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { makeTrack, moodFor } from "./music.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOLD = 3.2, FADE = 0.5; // must match reel() in render.mjs
const { posts } = JSON.parse(await readFile(join(ROOT, "posts.json"), "utf8"));
const only = process.argv.slice(2).map(Number).filter(Boolean);

for (const post of posts.filter((p) => p.format === "reel" && (!only.length || only.includes(p.day)))) {
  const id = `d${String(post.day).padStart(2, "0")}`;
  const mp4 = join(ROOT, "media", `${id}.mp4`);
  const seconds = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4]).toString().trim());
  const transitions = post.slides.slice(1).map((_, i) => (i + 1) * HOLD + FADE / 2);
  const mood = moodFor(post.sound);
  const wav = join(tmpdir(), `endureqr-${id}.wav`);
  await writeFile(wav, makeTrack({ mood, seconds, seed: post.day, transitions }));
  const out = join(ROOT, "media", `${id}.tmp.mp4`);
  execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", mp4, "-i", wav,
    "-map", "0:v", "-map", "1:a", "-c:v", "copy",
    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "160k",
    "-shortest", "-movflags", "+faststart", out]);
  await rename(out, mp4);
  await rm(wav, { force: true });
  console.log(`${id}  ${mood.padEnd(6)}  ${seconds.toFixed(1)} s, ${transitions.length} transitions`);
}

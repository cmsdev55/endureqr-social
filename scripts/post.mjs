#!/usr/bin/env node
/**
 * Posts one day from posts.json to the EndureQR Instagram account and Facebook Page (Meta's free Graph API)
 * and to X (pay-per-use API, see scripts/x.mjs). Run daily by .github/workflows/social-post.yml.
 *
 *   node scripts/post.mjs --dry-run            # show today's post, send nothing
 *   node scripts/post.mjs --day 5 --dry-run    # show day 5
 *   node scripts/post.mjs --day 5              # post day 5 now
 *
 * Environment (GitHub → Settings → Secrets and variables → Actions):
 *   META_PAGE_TOKEN    secret   long-lived Page access token (see SETUP.md)
 *   FB_PAGE_ID         secret   numeric Facebook Page id
 *   IG_USER_ID         secret   numeric Instagram professional (Creator or Business) account id
 *   SOCIAL_START_DATE  variable YYYY-MM-DD that is day 1 (UTC)
 *   X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET   secrets   X app keys (SETUP.md, X section)
 *   SOCIAL_PLATFORMS   variable optional, any of "ig,fb,x" (default "ig,fb")
 *   X_INCLUDE_LINK     variable optional, "true" adds the guide link to X posts (X charges much more for links)
 *   SOCIAL_REELS_AUTO  variable optional, where reels are auto-posted: "fb" (default), "ig,fb" or "none".
 *                      Instagram's API can't add sounds from its music library, so by default Instagram
 *                      reels are scheduled by hand in the app with a sound (REELS.md lists them).
 *
 * Images and reels must already be live on GitHub Pages (media/ pushed to main, Pages enabled).
 */
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { captionsFor, dayFor, mediaFor } from "./captions.mjs";
import { postToX, xLength, X_KEYS } from "./x.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GRAPH = `https://graph.facebook.com/${process.env.GRAPH_VERSION || "v23.0"}`;
const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const dayArg = argv.includes("--day") ? Number(argv[argv.indexOf("--day") + 1]) : null;
const list = (v) => v.split(",").map((s) => s.trim()).filter((s) => s && s !== "none");
const platforms = list(process.env.SOCIAL_PLATFORMS || "ig,fb");
const reelsAuto = list(process.env.SOCIAL_REELS_AUTO || "fb");

const { posts, hashtagsBase = [] } = JSON.parse(await readFile(join(ROOT, "posts.json"), "utf8"));

function today() {
  if (dayArg) return dayArg;
  const start = process.env.SOCIAL_START_DATE;
  if (!start) notSetUp("SOCIAL_START_DATE variable is not set");
  return dayFor(start);
}

const day = today();
const post = posts.find((p) => p.day === day);
if (!post) {
  console.log(`Day ${day}: nothing scheduled (posts.json has days ${posts[0].day}–${posts.at(-1).day}). Add more posts to keep going.`);
  process.exit(0);
}

const media = mediaFor(post);
const { ig: captionIG, fb: captionFB, x: captionX, marker } = captionsFor(post, hashtagsBase);
const NAMES = { ig: "Instagram", fb: "Facebook", x: "X" };
/** Reels go to Instagram/Facebook only where SOCIAL_REELS_AUTO allows (the rest are posted by hand with a sound). X always gets them. */
let targets = post.format === "reel" ? platforms.filter((p) => p === "x" || reelsAuto.includes(p)) : platforms;
const manual = platforms.filter((p) => !targets.includes(p));

console.log(`Day ${day} · ${post.format} · ${post.link}`);
console.log(JSON.stringify(media, null, 2));
if (manual.length) console.log(`Reel: not auto-posted to ${manual.map((p) => NAMES[p]).join(" + ")} (schedule it by hand with a sound, see REELS.md)`);
if (targets.includes("x")) {
  if (!captionX) throw new Error(`Day ${day} has no "x" text in posts.json`);
  if (xLength(captionX) > 280) throw new Error(`Day ${day} X text is ${xLength(captionX)} characters; X allows 280`);
}
if (!targets.length) process.exit(0);
if (DRY) {
  console.log(`\n--- Instagram caption ---\n${captionIG}\n\n--- Facebook caption ---\n${captionFB}`);
  if (captionX) console.log(`\n--- X post (${xLength(captionX)}/280${media.images?.length > 4 ? `, first 4 of ${media.images.length} images` : ""}) ---\n${captionX}`);
  await checkMedia().catch((e) => console.log(`\n(media check: ${e.message})`));
  process.exit(0);
}

// Each platform runs only once its own keys are in GitHub Secrets, so X can be set up before or after Meta.
const META = ["META_PAGE_TOKEN", "FB_PAGE_ID", "IG_USER_ID"];
const skipped = [];
for (const [p, keys] of [["ig", META], ["fb", META], ["x", X_KEYS]]) {
  const missing = keys.filter((n) => !process.env[n]);
  if (targets.includes(p) && missing.length) { skipped.push(`${NAMES[p]} (missing ${missing.join(", ")})`); targets = targets.filter((t) => t !== p); }
}
if (skipped.length) console.log(`::warning::Not set up yet, skipped: ${skipped.join("; ")}. See SETUP.md.`);
if (targets.includes("x") && process.env.X_DONE === "true") { console.log("X: already posted today, skipping"); targets = targets.filter((t) => t !== "x"); }
if (!targets.length) process.exit(0);
const TOKEN = process.env.META_PAGE_TOKEN, PAGE = process.env.FB_PAGE_ID, IG = process.env.IG_USER_ID;
await checkMedia();
const failures = [];
if (targets.includes("ig")) await instagram().catch((e) => failures.push(`Instagram: ${e.message}`));
if (targets.includes("fb")) await facebook().catch((e) => failures.push(`Facebook: ${e.message}`));
if (targets.includes("x")) await x().catch((e) => failures.push(`X: ${e.message}`));
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

// ───────────────────────────────────────────── helpers

/** Before SETUP.md is finished the daily run skips with a warning instead of failing (and emailing) every day. */
function notSetUp(why) {
  console.log(`::warning::Not set up yet (${why}). Nothing posted. See SETUP.md, steps 3–4.`);
  process.exit(0);
}

async function api(path, params = {}, method = "POST") {
  const body = new URLSearchParams({ ...params, access_token: TOKEN });
  const url = method === "GET" ? `${GRAPH}/${path}?${body}` : `${GRAPH}/${path}`;
  const res = await fetch(url, method === "GET" ? {} : { method, body });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(`${path}: ${json.error?.message || res.status}`);
  return json;
}

/** A function declaration (hoisted), not a const: instagram() runs before this line is reached. */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Every file must be reachable before Meta tries to fetch it. */
async function checkMedia() {
  const urls = media.images || [media.video, media.cover];
  for (const u of urls) {
    const r = await fetch(u, { method: "HEAD" });
    if (!r.ok) throw new Error(`${u} returned ${r.status}. Render, push media/ to main and wait for GitHub Pages to deploy.`);
  }
}

/** Instagram needs containers to finish processing (videos take a while) before publishing. */
async function waitReady(container) {
  for (let i = 0; i < 40; i++) {
    const { status_code } = await api(container, { fields: "status_code" }, "GET");
    if (status_code === "FINISHED") return;
    if (status_code === "ERROR" || status_code === "EXPIRED") throw new Error(`container ${container} ${status_code}`);
    await sleep(10_000);
  }
  throw new Error(`container ${container} not ready after 400 s`);
}

async function instagram() {
  const recent = await api(`${IG}/media`, { fields: "caption", limit: "10" }, "GET");
  if (recent.data?.some((m) => m.caption?.startsWith(marker))) return console.log("Instagram: already posted today, skipping");

  let creation;
  if (post.format === "reel") {
    creation = (await api(`${IG}/media`, { media_type: "REELS", video_url: media.video, cover_url: media.cover, caption: captionIG, share_to_feed: "true" })).id;
  } else if (media.images.length === 1) {
    creation = (await api(`${IG}/media`, { image_url: media.images[0], caption: captionIG })).id;
  } else {
    const children = [];
    for (const image_url of media.images) children.push((await api(`${IG}/media`, { image_url, is_carousel_item: "true" })).id);
    creation = (await api(`${IG}/media`, { media_type: "CAROUSEL", children: children.join(","), caption: captionIG })).id;
  }
  await waitReady(creation);
  const { id: mediaId } = await api(`${IG}/media_publish`, { creation_id: creation });
  console.log(`Instagram: published ${mediaId}`);
}

async function facebook() {
  // /posts also lists reels posted through /videos (checked 2026-11-11), so a repeat run skips them too
  const recent = await api(`${PAGE}/posts`, { fields: "message", limit: "15" }, "GET");
  if (recent.data?.some((p) => p.message?.startsWith(marker))) return console.log("Facebook: already posted today, skipping");

  let res;
  if (post.format === "reel") {
    res = await api(`${PAGE}/videos`, { file_url: media.video, description: captionFB });
  } else if (media.images.length === 1) {
    res = await api(`${PAGE}/photos`, { url: media.images[0], message: captionFB });
  } else {
    const attached = {};
    for (const [i, url] of media.images.entries()) {
      const { id } = await api(`${PAGE}/photos`, { url, published: "false" });
      attached[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
    }
    res = await api(`${PAGE}/feed`, { message: captionFB, ...attached });
  }
  console.log(`Facebook: published ${res.post_id || res.id}`);
}

/**
 * Checking X's timeline for today's post would cost API credits on every run, so the workflow keeps a free
 * marker instead: .x-posted is saved to the GitHub Actions cache and becomes X_DONE=true on later runs that day.
 */
async function x() {
  const keys = Object.fromEntries(X_KEYS.map((k) => [k, process.env[k]]));
  const id = await postToX(keys, captionX, media.video ? { video: media.video } : { images: media.images });
  await writeFile(join(process.cwd(), ".x-posted"), `${day} ${id}\n`);
  console.log(`X: published ${id}`);
}

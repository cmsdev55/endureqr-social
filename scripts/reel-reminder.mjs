#!/usr/bin/env node
/**
 * On a reel day, opens a GitHub issue assigned to the repo owner: "Today: post the Day N reel on Instagram".
 * GitHub emails it and pushes it to the GitHub mobile app, with the video link, sound mood and caption.
 * Close the issue once the reel is posted. Run every morning by .github/workflows/reel-reminder.yml.
 *
 *   node scripts/reel-reminder.mjs --dry-run           # show what today's reminder would say
 *   node scripts/reel-reminder.mjs --day 5 --dry-run   # for day 5
 *
 * Environment: SOCIAL_START_DATE (variable), GITHUB_TOKEN + GITHUB_REPOSITORY (given by Actions),
 * REMINDER_ASSIGNEE (optional, default: the repo owner).
 */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { captionsFor, dateFor, dayFor, mediaFor } from "./captions.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const dayArg = argv.includes("--day") ? Number(argv[argv.indexOf("--day") + 1]) : null;
const start = process.env.SOCIAL_START_DATE;
if (!start && !dayArg) {
  console.log("::warning::SOCIAL_START_DATE is not set; no reminder.");
  process.exit(0);
}

const { posts, hashtagsBase = [] } = JSON.parse(await readFile(join(ROOT, "posts.json"), "utf8"));
const day = dayArg || dayFor(start);
const post = posts.find((p) => p.day === day);
if (!post || post.format !== "reel") {
  console.log(`Day ${day}: not a reel day, no reminder.`);
  process.exit(0);
}

const nextReel = posts.find((p) => p.format === "reel" && p.day > day);
const title = `🎬 Today: post the Day ${day} reel on Instagram (by 7 pm)`;
const body = `Today${start ? ` (${dateFor(start, day)})` : ""} is a reel day. Instagram reels are posted by hand so you can add a sound.
Facebook gets this reel automatically at 7 pm, so only Instagram is needed.

**1. Video** (open on your phone → save): ${mediaFor(post).video}

**2. Sound mood:** ${post.sound || "any trending sound"}. In the Instagram app: + → Reel → pick the video → ♫ Audio.

**3. Caption** (copy):

\`\`\`
${captionsFor(post, hashtagsBase).ig}
\`\`\`

**4.** Post it now, or tap **Advanced settings → Schedule** for 7:00 pm today.

When it's up, close this issue.${nextReel ? `\n\nNext reel: Day ${nextReel.day}${start ? ` (${dateFor(start, nextReel.day)})` : ""}.` : ""}`;

console.log(`${title}\n\n${body}`);
if (DRY) process.exit(0);

const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
if (!repo || !token) throw new Error("GITHUB_REPOSITORY and GITHUB_TOKEN are required (they're set automatically in Actions)");
const api = (path, init = {}) =>
  fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
  }).then(async (r) => {
    const json = await r.json();
    if (!r.ok) throw new Error(`${path}: ${r.status} ${json.message}`);
    return json;
  });

const open = await api(`/issues?state=all&per_page=30`);
if (open.some((i) => i.title === title)) {
  console.log("Reminder for this day already exists, skipping.");
  process.exit(0);
}
const assignee = process.env.REMINDER_ASSIGNEE || repo.split("/")[0];
const issue = await api(`/issues`, { method: "POST", body: JSON.stringify({ title, body, assignees: [assignee] }) });
console.log(`\nReminder created: ${issue.html_url}`);

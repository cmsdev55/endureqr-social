#!/usr/bin/env node
/**
 * Every morning, opens a GitHub issue assigned to the repo owner with TODAY's X (Twitter) post: the text (with the
 * guide link, which costs nothing when you post by hand), a one-click "open X with this text" link, and the images
 * or video to attach. GitHub emails it and pushes it to the GitHub mobile app. Yesterday's reminder is closed
 * automatically. Free: no X API, no email service. Run daily by .github/workflows/x-reminder.yml.
 *
 *   node scripts/x-reminder.mjs --dry-run           # what today's reminder would say
 *   node scripts/x-reminder.mjs --day 5 --dry-run   # the reminder for day 5
 *
 * Environment: SOCIAL_START_DATE (variable), GITHUB_TOKEN + GITHUB_REPOSITORY (given by Actions),
 * REMINDER_ASSIGNEE (optional, default: the repo owner).
 */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE, dateFor, dayFor, mediaFor } from "./captions.mjs";
import { xLength } from "./x.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const dayArg = argv.includes("--day") ? Number(argv[argv.indexOf("--day") + 1]) : null;
const start = process.env.SOCIAL_START_DATE;
if (!start && !dayArg) {
  console.log("::warning::SOCIAL_START_DATE is not set; no reminder.");
  process.exit(0);
}

const { posts } = JSON.parse(await readFile(join(ROOT, "posts.json"), "utf8"));
const day = dayArg || dayFor(start);
const post = posts.find((p) => p.day === day);
if (!post?.x) {
  console.log(`Day ${day}: no X post in posts.json, no reminder.`);
  process.exit(0);
}

const link = `${SITE}${post.link === "/" ? "" : post.link}`;
const text = `${post.x}\n\n${link}`;
if (xLength(text) > 280) throw new Error(`Day ${day} X text is ${xLength(text)} characters; X allows 280`);
const media = mediaFor(post);
const when = start ? dateFor(start, day) : `day ${day}`;
const intent = `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
const title = `𝕏 Today (${when}): Day ${day} post for X`;

const attach = media.video
  ? `**2. Attach the video** (open → save, then add it in X with the 🖼️ button): ${media.video}`
  : `**2. Attach ${Math.min(media.images.length, 4)} image${media.images.length > 1 ? "s" : ""}** (X allows 4; save them, then add them in X with the 🖼️ button):

${media.images.slice(0, 4).map((u, i) => `[Image ${i + 1}](${u})`).join(" · ")}

${media.images.slice(0, 4).map((u) => `<img src="${u}" width="160">`).join(" ")}`;

const body = `**1. [Open X with today's text already filled in](${intent})** (on your phone it opens the X app)

Or copy it (${xLength(text)}/280):

\`\`\`
${text}
\`\`\`

${attach}

**3.** Post it, or tap 🕒 in X to schedule it for **7:00 pm** (when Instagram and Facebook go out).

Close this issue when it's done. Tomorrow's reminder closes it for you anyway.`;

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

const recent = await api(`/issues?state=all&per_page=50`);
const mine = recent.filter((i) => !i.pull_request && i.title.startsWith("𝕏 Today"));
if (mine.some((i) => i.title === title)) {
  console.log("Reminder for today already exists, skipping.");
  process.exit(0);
}
for (const old of mine.filter((i) => i.state === "open")) {
  await api(`/issues/${old.number}`, { method: "PATCH", body: JSON.stringify({ state: "closed", state_reason: "not_planned" }) });
  console.log(`Closed yesterday's reminder #${old.number}`);
}
const assignee = process.env.REMINDER_ASSIGNEE || repo.split("/")[0];
const issue = await api(`/issues`, { method: "POST", body: JSON.stringify({ title, body, assignees: [assignee] }) });
console.log(`\nReminder created: ${issue.html_url}`);

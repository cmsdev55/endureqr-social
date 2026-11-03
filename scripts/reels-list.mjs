#!/usr/bin/env node
/**
 * Writes REELS.md: the reels to schedule by hand in the Instagram app (with a sound from its library),
 * each with its date, video link, suggested sound mood and the exact caption.
 *
 *   SOCIAL_START_DATE=2026-11-06 npm run reels     # with dates
 *   npm run reels                                  # day numbers only
 */
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { captionsFor, dateFor, mediaFor } from "./captions.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const { posts, hashtagsBase = [] } = JSON.parse(await readFile(join(ROOT, "posts.json"), "utf8"));
const start = process.env.SOCIAL_START_DATE || "";
if (start && !/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new Error(`SOCIAL_START_DATE must look like 2026-11-06, got "${start}"`);
const reels = posts.filter((p) => p.format === "reel");
const when = (day) => (start ? `${dateFor(start, day)}, 7:00 pm (Pakistan)` : `Day ${day}`);

let md = `# Reels to schedule in Instagram

Instagram's API can't add a sound from the app's music library, so these ${reels.length} reels are scheduled by hand
(steps in [SETUP.md](SETUP.md#reels-instagram-pe-haath-se-sound-ke-saath-mahine-mein-ek-dafa-2030-minute)).
Everything else is posted automatically.

${start ? `Day 1 = ${start}.` : "Dates appear once `SOCIAL_START_DATE` is set: `SOCIAL_START_DATE=2026-11-06 npm run reels`."}

| Day | Date | Sound mood | Video |
|---|---|---|---|
${reels.map((p) => `| ${p.day} | ${start ? dateFor(start, p.day) : "-"} | ${p.sound || "-"} | [d${String(p.day).padStart(2, "0")}.mp4](${mediaFor(p).video}) |`).join("\n")}
`;

for (const p of reels) {
  md += `
---

## Day ${p.day}: ${p.slides[0].title.replace(/\*\*/g, "")}

- **When:** ${when(p.day)}
- **Video:** ${mediaFor(p).video}
- **Sound:** ${p.sound || "any trending sound"}. Search the mood in the Audio tab, or pick a trending one (↗ arrow) that fits.

Caption (copy):

\`\`\`
${captionsFor(p, hashtagsBase).ig}
\`\`\`
`;
}

await writeFile(join(ROOT, "REELS.md"), md);
console.log(`REELS.md: ${reels.length} reels${start ? ` from ${start}` : " (no dates: SOCIAL_START_DATE not set)"}`);

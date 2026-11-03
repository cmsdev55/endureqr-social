/** Shared by post.mjs and reels-list.mjs, so the auto-posted and hand-posted captions are identical. */
export const SITE = (process.env.SITE_URL || "https://endureqr.com").replace(/\/$/, ""); // caption links
export const MEDIA = (process.env.MEDIA_BASE || "https://cmsdev55.github.io/endureqr-social/media").replace(/\/$/, "");

export const mediaId = (day) => `d${String(day).padStart(2, "0")}`;

export function mediaFor(post) {
  const id = mediaId(post.day);
  return post.format === "reel"
    ? { video: `${MEDIA}/${id}.mp4`, cover: `${MEDIA}/${id}-cover.jpg` }
    : { images: post.slides.map((_, i) => `${MEDIA}/${id}-${i + 1}.jpg`) };
}

export function captionsFor(post, hashtagsBase = []) {
  const tags = [...new Set([...(post.hashtags || []), ...hashtagsBase])].slice(0, 5).join(" "); // Instagram allows 5
  const link = `${SITE}${post.link === "/" ? "" : post.link}`;
  return {
    ig: `${post.caption}\n\n🔗 Free guide: link in bio (${link.replace(/^https:\/\//, "")})\n\n${tags}`,
    fb: `${post.caption}\n\n🔗 ${link}\n\n${tags}`,
    marker: post.caption.split("\n")[0].slice(0, 40),
  };
}

/** Day number (1-based) for a UTC date, given SOCIAL_START_DATE. */
export function dayFor(start, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new Error(`SOCIAL_START_DATE must look like 2026-11-06, got "${start}"`);
  return Math.floor((now - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
}

export const dateFor = (start, day) => new Date(Date.parse(`${start}T00:00:00Z`) + (day - 1) * 86_400_000).toISOString().slice(0, 10);

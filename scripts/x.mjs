/**
 * Posts to X (Twitter) through the v2 API, signed with OAuth 1.0a user keys (no extra packages).
 *
 * X API posting is pay-per-use (no free tier for new developers since Feb 2026): about $0.015 a post,
 * $0.20 if the text contains a link. So by default the text has no link ("link in bio"); set X_INCLUDE_LINK=true
 * to add one. Check current prices in the X Developer Console.
 *
 * Keys (X Developer Console → your app → Keys and tokens; the app needs "Read and write" permission, and the
 * access token must be generated AFTER that is set):
 *   X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
 */
import { createHmac, randomBytes } from "node:crypto";

const API = "https://api.x.com/2";
export const X_KEYS = ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_SECRET"];

/** X counts most emoji and CJK as 2 and every link as 23. Close enough to its own counter for a pre-check. */
export function xLength(text) {
  let n = 0;
  for (const part of text.split(/(https?:\/\/\S+)/)) {
    if (/^https?:\/\//.test(part)) { n += 23; continue; }
    for (const ch of part) {
      const cp = ch.codePointAt(0);
      // variation selectors / zero-width joiners add nothing visible
      if (cp === 0xfe0f || cp === 0x200d || (cp >= 0x1f3fb && cp <= 0x1f3ff)) continue;
      n += cp <= 0x10ff || (cp >= 0x2000 && cp <= 0x200d) || (cp >= 0x2010 && cp <= 0x201f) || (cp >= 0x2032 && cp <= 0x2037) ? 1 : 2;
    }
  }
  return n;
}

const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/** OAuth 1.0a header. Only query params are signed: JSON and multipart bodies are not part of the signature. */
export function authHeader(method, url, keys, fixed = {}) {
  const u = new URL(url);
  const oauth = {
    oauth_consumer_key: keys.X_API_KEY,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: keys.X_ACCESS_TOKEN,
    oauth_version: "1.0",
    ...fixed, // tests only: pin the nonce and timestamp
  };
  const params = [...u.searchParams.entries(), ...Object.entries(oauth)]
    .map(([k, v]) => [enc(k), enc(v)])
    .sort(([a, av], [b, bv]) => (a === b ? (av < bv ? -1 : 1) : a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const base = [method.toUpperCase(), enc(`${u.origin}${u.pathname}`), enc(params)].join("&");
  const key = `${enc(keys.X_API_SECRET)}&${enc(keys.X_ACCESS_SECRET)}`;
  oauth.oauth_signature = createHmac("sha1", key).update(base).digest("base64");
  return "OAuth " + Object.entries(oauth).map(([k, v]) => `${enc(k)}="${enc(v)}"`).join(", ");
}

async function call(keys, method, path, { json, form } = {}) {
  const url = `${API}${path}`;
  const headers = { Authorization: authHeader(method, url, keys) };
  let body;
  if (json) { headers["Content-Type"] = "application/json"; body = JSON.stringify(json); }
  if (form) body = form;
  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok || (data.errors && !data.data)) {
    const why = data.detail || data.title || data.errors?.map((e) => e.message || e.detail).join("; ") || data.raw || res.status;
    throw new Error(`${method} ${path}: ${res.status} ${why}`);
  }
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function download(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} returned ${r.status}`);
  return { bytes: Buffer.from(await r.arrayBuffer()), type: r.headers.get("content-type")?.split(";")[0] || "application/octet-stream" };
}

async function uploadImage(keys, url) {
  const { bytes, type } = await download(url);
  const form = new FormData();
  form.append("media", new Blob([bytes], { type }), url.split("/").pop());
  form.append("media_category", "tweet_image");
  return (await call(keys, "POST", "/media/upload", { form })).data.id;
}

/** Videos use the chunked flow: initialize → append (≤5 MB chunks) → finalize → poll status. */
async function uploadVideo(keys, url) {
  const { bytes } = await download(url);
  const { id } = (await call(keys, "POST", "/media/upload/initialize", { json: { media_type: "video/mp4", total_bytes: bytes.length, media_category: "tweet_video" } })).data;
  const CHUNK = 4 * 1024 * 1024;
  for (let i = 0, seg = 0; i < bytes.length; i += CHUNK, seg++) {
    const form = new FormData();
    form.append("segment_index", String(seg));
    form.append("media", new Blob([bytes.subarray(i, i + CHUNK)], { type: "application/octet-stream" }), "chunk");
    await call(keys, "POST", `/media/upload/${id}/append`, { form });
  }
  let info = (await call(keys, "POST", `/media/upload/${id}/finalize`)).data.processing_info;
  for (let tries = 0; info && info.state !== "succeeded"; tries++) {
    if (info.state === "failed" || tries > 30) throw new Error(`video ${id} processing ${info.state}: ${info.error?.message || ""}`);
    await sleep((info.check_after_secs || 5) * 1000);
    info = (await call(keys, "GET", `/media/upload?command=STATUS&media_id=${id}`)).data.processing_info;
  }
  return id;
}

/** media: { images: [...] } (up to 4 are used) or { video }. Returns the new post id. */
export async function postToX(keys, text, media) {
  const ids = media.video ? [await uploadVideo(keys, media.video)] : [];
  if (media.images) for (const u of media.images.slice(0, 4)) ids.push(await uploadImage(keys, u));
  const res = await call(keys, "POST", "/tweets", { json: { text, ...(ids.length ? { media: { media_ids: ids } } : {}) } });
  return res.data.id;
}

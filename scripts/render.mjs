#!/usr/bin/env node
/**
 * Renders the posts in posts.json into images and reels in media/. GitHub Pages serves that folder at
 * https://cmsdev55.github.io/endureqr-social/media/… (Instagram's API needs a public URL).
 *
 *   npm run render            # every day
 *   npm run render -- 3 7     # only days 3 and 7
 *
 * Feed posts (single, carousel): 1080×1350 JPEGs  → media/dNN-1.jpg, dNN-2.jpg …
 * Reels: 1080×1920 slides joined by ffmpeg        → media/dNN.mp4 (+ dNN-cover.jpg)
 * Needs `npm install` (Playwright + qrcode-generator) and ffmpeg on PATH for reels.
 * Fonts are read from the EndureQR site checkout (not stored here): set FONTS_DIR if it isn't at ../stayqr/src/fonts.
 */
import { readFile, mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { chromium } from "playwright";
import qrcode from "qrcode-generator";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "media");
const FONTS = process.env.FONTS_DIR || join(ROOT, "../stayqr/src/fonts");
const { posts } = JSON.parse(await readFile(join(ROOT, "posts.json"), "utf8"));
const only = process.argv.slice(2).map(Number).filter(Boolean);

const C = { bg: "#07080B", raised: "#0D0F14", ink: "#F2F4F7", muted: "#9AA3B2", subtle: "#7A8294", lime: "#B6FF3B", limeInk: "#0A0D02", depth: "#6E7BFF", danger: "#FF6B6B" };
const font = async (f) => (await readFile(join(FONTS, f))).toString("base64");
const [clash5, clash6, inter, mono] = await Promise.all(["ClashDisplay-500.woff2", "ClashDisplay-600.woff2", "Inter-Variable.woff2", "JetBrainsMono-Variable.woff2"].map(font));

const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** **word** → lime span */
const rich = (s = "") => esc(s).replace(/\*\*(.+?)\*\*/g, `<span class="hl">$1</span>`);

/** A QR code as SVG. `scan` = true: dark on white with a quiet zone, so it really scans. */
function qrSvg(text, { size, scan = true }) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount(), q = scan ? 4 : 0, cell = size / (n + q * 2);
  let m = "";
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.isDark(r, c)) m += `<rect x="${((c + q) * cell).toFixed(2)}" y="${((r + q) * cell).toFixed(2)}" width="${(cell + 0.4).toFixed(2)}" height="${(cell + 0.4).toFixed(2)}" rx="${(cell * 0.12).toFixed(2)}"/>`; // no gaps: gaps defeat some scanners
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${scan ? `<rect width="${size}" height="${size}" rx="${cell * 2}" fill="#fff"/>` : ""}<g fill="${scan ? "#07080B" : C.lime}">${m}</g></svg>`;
}

/** Decorative tilted code with a lime scan line, like the site's OG image. Not meant to be scanned. */
function sceneSvg(w) {
  const qr = qrcode(1, "M");
  qr.addData("HTTPS://ENDUREQR.COM", "Alphanumeric");
  qr.make();
  const n = qr.getModuleCount(), cell = w / n, scanRow = 12.4;
  let m = "";
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      if (!qr.isDark(r, c)) continue;
      const lit = r <= scanRow && r > scanRow - 3.2 ? 1 - (scanRow - r) / 3.2 : 0;
      const fill = lit > 0 ? (lit > 0.5 ? C.lime : "#C9E89A") : "#D5DAE2";
      m += `<rect x="${c * cell + 1.6}" y="${r * cell + 1.6}" width="${cell - 3.2}" height="${cell - 3.2}" rx="${cell * 0.22}" fill="${fill}" opacity="${lit > 0 ? 1 : 0.55}"/>`;
    }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w + 120}" height="${w + 120}" viewBox="-60 -60 ${w + 120} ${w + 120}">
    <defs><filter id="b" x="-20%" y="-400%" width="140%" height="900%"><feGaussianBlur stdDeviation="8"/></filter></defs>
    <rect x="-30" y="-30" width="${w + 60}" height="${w + 60}" rx="34" fill="${C.raised}" stroke="#fff" stroke-opacity="0.08"/>
    ${m}
    <rect x="-50" y="${scanRow * cell + cell - 3}" width="${w + 100}" height="14" fill="${C.lime}" filter="url(#b)" opacity="0.9"/>
    <rect x="-50" y="${scanRow * cell + cell + 2}" width="${w + 100}" height="4" rx="2" fill="#E6FFB8"/>
  </svg>`;
}

const MARK = `<svg width="44" height="44" viewBox="0 0 32 32"><rect x="2" y="2" width="28" height="28" rx="7" fill="none" stroke="${C.ink}" stroke-width="4"/><rect x="10.5" y="10.5" width="11" height="11" rx="3.2" fill="${C.lime}"/></svg>`;

function slideBody(s, H) {
  const eyebrow = s.eyebrow ? `<div class="eyebrow">${esc(s.eyebrow)}</div>` : "";
  switch (s.kind) {
    case "cover":
      return `<div class="scene">${sceneSvg(H > 1500 ? 560 : 470)}</div>
        <div class="stack top">${eyebrow}<h1 class="xl">${rich(s.title)}</h1><p class="sub">${esc(s.sub)}</p></div>`;
    case "point":
      return `<div class="ghost">${esc(s.num)}</div><div class="stack mid">${eyebrow}<div class="num">${esc(s.num)}</div><h2 class="lg">${rich(s.title)}</h2><p class="body">${esc(s.body)}</p></div>`;
    case "list":
      return `<div class="stack mid">${eyebrow}<h2 class="lg">${rich(s.title)}</h2><ul class="list">${s.items.map((i) => `<li><span class="tick">✓</span>${esc(i)}</li>`).join("")}</ul></div>`;
    case "stat":
      return `<div class="stack mid">${eyebrow}<div class="big">${esc(s.big)}</div><div class="label">${esc(s.label)}</div><p class="body">${esc(s.body)}</p></div>`;
    case "levels":
      return `<div class="stack mid">${eyebrow}<h2 class="lg">${rich(s.title)}</h2>
        <div class="levels">${s.levels.map(([l, p], i) => `<div class="lvl"><div class="bar" style="height:${80 + i * 70}px"></div><div class="lv">${l}</div><div class="pc">${p}</div></div>`).join("")}</div>
        <p class="body">${esc(s.body)}</p></div>`;
    case "compare":
      return `<div class="stack mid">${eyebrow}<h2 class="lg">${rich(s.title)}</h2><div class="cmp">
        ${[s.left, s.right].map((col, i) => `<div class="col ${i ? "on" : ""}"><div class="ch">${esc(col.label)}</div><ul>${col.items.map((it) => `<li>${esc(it)}</li>`).join("")}</ul></div>`).join("")}
      </div></div>`;
    case "cta":
      return `<div class="stack mid center"><h2 class="lg">${rich(s.title)}</h2><p class="body">${esc(s.body)}</p>
        <div class="qr">${qrSvg(s.url, { size: H > 1500 ? 420 : 360 })}</div>
        <div class="url">${esc(s.url.replace(/^https:\/\//, ""))}</div></div>`;
    default:
      throw new Error(`Unknown slide kind: ${s.kind}`);
  }
}

function page(s, { W, H, index, total, carousel }) {
  const tall = H > 1500;
  const counter = carousel && total > 1 ? `<span>${index}/${total}</span>${index === 1 ? `<span class="swipe">Swipe →</span>` : ""}` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:"Clash Display";font-weight:500;src:url(data:font/woff2;base64,${clash5}) format("woff2")}
  @font-face{font-family:"Clash Display";font-weight:600;src:url(data:font/woff2;base64,${clash6}) format("woff2")}
  @font-face{font-family:"Inter";font-weight:100 900;src:url(data:font/woff2;base64,${inter}) format("woff2")}
  @font-face{font-family:"JetBrains Mono";font-weight:100 900;src:url(data:font/woff2;base64,${mono}) format("woff2")}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${W}px;height:${H}px;background:${C.bg};color:${C.ink};font-family:Inter,sans-serif;overflow:hidden}
  .frame{position:relative;width:100%;height:100%;padding:${tall ? "150px 84px 170px" : "84px 84px 120px"};
    background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:64px 64px}
  .glow{position:absolute;right:-200px;bottom:-160px;width:900px;height:900px;border-radius:50%;background:radial-gradient(${C.depth}55,transparent 65%)}
  .brand{position:absolute;left:84px;top:${tall ? 110 : 64}px;display:flex;align-items:center;gap:16px;font-family:"Clash Display";font-weight:600;font-size:36px;letter-spacing:-.02em}
  .foot{position:absolute;left:84px;right:84px;bottom:${tall ? 120 : 60}px;display:flex;justify-content:space-between;font-family:"JetBrains Mono";font-size:26px;color:${C.subtle};letter-spacing:.04em}
  .foot .swipe{color:${C.lime}}
  .stack{position:relative;display:flex;flex-direction:column;gap:30px;height:100%;justify-content:center}
  .stack.top{justify-content:flex-start;padding-top:${tall ? 170 : 120}px}
  .center{align-items:center;text-align:center}
  .eyebrow{align-self:flex-start;font-family:"JetBrains Mono";font-weight:500;font-size:26px;text-transform:uppercase;letter-spacing:.1em;color:${C.lime};background:rgba(182,255,59,.12);border:1px solid rgba(182,255,59,.35);padding:12px 22px;border-radius:999px}
  h1.xl{font-family:"Clash Display";font-weight:600;font-size:${tall ? 124 : 112}px;line-height:.95;letter-spacing:-.04em;max-width:900px}
  h2.lg{font-family:"Clash Display";font-weight:600;font-size:${tall ? 92 : 84}px;line-height:1;letter-spacing:-.035em}
  h1.xl,h2.lg,.big{word-spacing:.12em}
  .hl{color:${C.lime}}
  .sub{font-size:38px;line-height:1.4;color:${C.muted};max-width:820px}
  .body{font-size:40px;line-height:1.45;color:${C.muted};max-width:900px}
  .num{font-family:"JetBrains Mono";font-weight:500;font-size:44px;color:${C.lime};letter-spacing:.04em}
  .big{font-family:"Clash Display";font-weight:600;font-size:${tall ? 260 : 220}px;line-height:.9;letter-spacing:-.05em;color:${C.lime}}
  .label{font-family:"JetBrains Mono";font-size:34px;text-transform:uppercase;letter-spacing:.08em;color:${C.ink}}
  .list{list-style:none;display:flex;flex-direction:column;gap:26px}
  .list li{display:flex;gap:24px;align-items:flex-start;font-size:44px;line-height:1.3;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:26px 30px}
  .tick{flex:none;display:grid;place-items:center;width:52px;height:52px;border-radius:14px;background:${C.lime};color:${C.limeInk};font-size:32px;font-weight:700}
  .cmp{display:grid;grid-template-columns:1fr 1fr;gap:24px}
  .col{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:24px;padding:34px}
  .col.on{border-color:rgba(182,255,59,.45);box-shadow:0 0 48px rgba(182,255,59,.12)}
  .ch{font-family:"JetBrains Mono";font-size:30px;text-transform:uppercase;letter-spacing:.08em;color:${C.muted};margin-bottom:24px}
  .col.on .ch{color:${C.lime}}
  .col ul{list-style:none;display:flex;flex-direction:column;gap:22px}
  .col li{font-size:36px;line-height:1.3}
  .levels{display:flex;gap:28px;align-items:flex-end;height:420px}
  .lvl{flex:1;display:flex;flex-direction:column;align-items:center;gap:14px}
  .bar{width:100%;border-radius:18px;background:linear-gradient(${C.lime},rgba(182,255,59,.25))}
  .lv{font-family:"Clash Display";font-weight:600;font-size:64px}
  .pc{font-family:"JetBrains Mono";font-size:34px;color:${C.muted}}
  .qr{margin-top:20px;padding:0;border-radius:28px;box-shadow:0 0 0 1px rgba(182,255,59,.35),0 0 40px rgba(182,255,59,.25)}
  .qr svg{display:block}
  .url{font-family:"JetBrains Mono";font-size:30px;color:${C.lime}}
  .ghost{position:absolute;right:40px;bottom:${tall ? 230 : 110}px;font-family:"Clash Display";font-weight:600;font-size:${tall ? 400 : 340}px;line-height:1;letter-spacing:-.05em;color:transparent;-webkit-text-stroke:3px rgba(182,255,59,.16)}
  .scene{position:absolute;right:-60px;bottom:${tall ? 120 : 30}px;transform:rotate(-11deg) skewX(9deg) scaleY(.92);opacity:.95}
</style></head><body><div class="frame"><div class="glow"></div>
  <div class="brand">${MARK}EndureQR</div>
  ${slideBody(s, H)}
  <div class="foot"><span>endureqr.com</span>${counter}</div>
</div></body></html>`;
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const shots = async (post, W, H, prefix) => {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const files = [];
  for (const [i, s] of post.slides.entries()) {
    await p.setContent(page(s, { W, H, index: i + 1, total: post.slides.length, carousel: post.format === "carousel" }));
    await p.evaluate(() => document.fonts.ready);
    const file = `${prefix}-${i + 1}.jpg`;
    await p.screenshot({ path: file, type: "jpeg", quality: 88 });
    files.push(file);
  }
  await ctx.close();
  return files;
};

for (const post of posts) {
  if (only.length && !only.includes(post.day)) continue;
  const id = `d${String(post.day).padStart(2, "0")}`;
  if (post.format === "reel") {
    const tmp = join(tmpdir(), `endureqr-reel-${id}`);
    await rm(tmp, { recursive: true, force: true });
    await mkdir(tmp, { recursive: true });
    const frames = await shots(post, 1080, 1920, join(tmp, "s"));
    execFileSync("cp", [frames[0], join(OUT, `${id}-cover.jpg`)]);
    reel(frames, join(OUT, `${id}.mp4`));
    console.log(`${id}  reel      ${frames.length} slides → ${id}.mp4`);
  } else {
    const files = await shots(post, 1080, 1350, join(OUT, id));
    console.log(`${id}  ${post.format.padEnd(9)} ${files.length} image(s)`);
  }
}
await browser.close();

/**
 * Slides → MP4: each slide holds for HOLD s with a slow zoom, cross-fading into the next.
 * H.264 High@4.1, yuv420p, 30 fps, silent AAC track (Instagram's Reels spec expects an audio stream).
 */
function reel(frames, out) {
  const HOLD = 3.2, FADE = 0.5, FPS = 30;
  const args = ["-y", "-hide_banner", "-loglevel", "error"];
  frames.forEach((f) => args.push("-loop", "1", "-t", String(HOLD + FADE), "-i", f));
  const total = frames.length * HOLD + FADE;
  args.push("-f", "lavfi", "-t", String(total), "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
  const zoom = frames.map((_, i) =>
    `[${i}:v]scale=1188:2112,zoompan=z='min(1+on/${FPS * 40},1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${Math.ceil((HOLD + FADE) * FPS)}:s=1080x1920:fps=${FPS},setsar=1,format=yuv420p[v${i}]`);
  let chain = "", last = "v0";
  for (let i = 1; i < frames.length; i++) {
    const outLabel = i === frames.length - 1 ? "vout" : `x${i}`;
    chain += `;[${last}][v${i}]xfade=transition=fade:duration=${FADE}:offset=${(i * HOLD).toFixed(2)}[${outLabel}]`;
    last = outLabel;
  }
  if (frames.length === 1) chain = ";[v0]null[vout]";
  args.push("-filter_complex", zoom.join(";") + chain, "-map", "[vout]", "-map", `${frames.length}:a`,
    "-c:v", "libx264", "-profile:v", "high", "-level", "4.1", "-pix_fmt", "yuv420p", "-r", String(FPS), "-crf", "27", "-preset", "slow", "-tune", "stillimage",
    "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", out);
  execFileSync("ffmpeg", args, { stdio: "inherit" });
}

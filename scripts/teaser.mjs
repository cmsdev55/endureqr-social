#!/usr/bin/env node
/**
 * Renders the Product Hunt teaser image: media/ph-teaser.jpg, 1080×1350 (Instagram/Facebook feed; X shows it too).
 * Posted on the date in specials.json.
 *
 *   node scripts/teaser.mjs
 */
import { readFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import qrcode from "qrcode-generator";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FONTS = process.env.FONTS_DIR || join(ROOT, "../stayqr/src/fonts");
const C = { bg: "#07080B", raised: "#0D0F14", ink: "#F2F4F7", muted: "#9AA3B2", subtle: "#7A8294", lime: "#B6FF3B", limeInk: "#0A0D02" };
const font = async (f) => (await readFile(join(FONTS, f))).toString("base64");
const [clash6, inter, mono] = await Promise.all(["ClashDisplay-600.woff2", "Inter-Variable.woff2", "JetBrainsMono-Variable.woff2"].map(font));

/** Decorative code with a lime scan line (same look as the posts). Not meant to be scanned. */
function scene(w) {
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
const tick = `<span class="tick">✓</span>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:"Clash Display";font-weight:600;src:url(data:font/woff2;base64,${clash6}) format("woff2")}
  @font-face{font-family:"Inter";font-weight:100 900;src:url(data:font/woff2;base64,${inter}) format("woff2")}
  @font-face{font-family:"JetBrains Mono";font-weight:100 900;src:url(data:font/woff2;base64,${mono}) format("woff2")}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1080px;height:1350px;overflow:hidden;background:${C.bg};color:${C.ink};font-family:Inter,sans-serif}
  .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:54px 54px;-webkit-mask-image:radial-gradient(ellipse 80% 60% at 75% 70%,#000 25%,transparent 75%)}
  .glow{position:absolute;right:-40px;bottom:180px;width:640px;height:640px;background:radial-gradient(circle,rgba(182,255,59,.15),transparent 65%)}
  .brand{position:absolute;left:84px;top:72px;display:flex;align-items:center;gap:16px;font-family:"Clash Display";font-weight:600;font-size:36px;letter-spacing:-.02em}
  .date{position:absolute;right:84px;top:80px;font-family:"JetBrains Mono";font-size:24px;color:${C.subtle};letter-spacing:.06em}
  .stack{position:absolute;left:84px;right:84px;top:200px;display:flex;flex-direction:column;gap:34px}
  .eyebrow{align-self:flex-start;font-family:"JetBrains Mono";font-weight:500;font-size:26px;text-transform:uppercase;letter-spacing:.1em;color:${C.lime};background:rgba(182,255,59,.12);border:1px solid rgba(182,255,59,.35);padding:12px 22px;border-radius:999px}
  h1{font-family:"Clash Display";font-weight:600;font-size:112px;line-height:.95;letter-spacing:-.04em}
  h1 span{color:${C.lime}}
  .sub{font-size:36px;line-height:1.35;color:${C.muted}}
  ul{list-style:none;display:flex;flex-direction:column;gap:20px;margin-top:6px;max-width:600px}
  li{display:flex;gap:20px;align-items:center;font-size:34px;line-height:1.25}
  .tick{flex:none;display:grid;place-items:center;width:46px;height:46px;border-radius:13px;background:${C.lime};color:${C.limeInk};font-size:28px;font-weight:700}
  .scene{position:absolute;right:30px;bottom:150px;transform:rotate(-9deg)}
  .foot{position:absolute;left:84px;right:84px;bottom:64px;display:flex;justify-content:space-between;align-items:center;font-family:"JetBrains Mono";font-size:28px;color:${C.subtle};letter-spacing:.04em}
  .foot .url{color:${C.lime}}
</style></head><body>
  <div class="grid"></div><div class="glow"></div>
  <div class="brand">${MARK}EndureQR</div>
  <div class="date">MON · 23 NOV</div>
  <div class="stack">
    <div class="eyebrow">🚀 Launching on Product Hunt</div>
    <h1>Launching<br><span>this Monday.</span></h1>
    <div class="sub">QR codes that keep working, even after you cancel.</div>
    <ul>
      <li>${tick}Free codes with your logo</li>
      <li>${tick}No sign-up, no watermark</li>
      <li>${tick}Editable dynamic codes</li>
      <li>${tick}Never switched off on you</li>
    </ul>
  </div>
  <div class="scene">${scene(330)}</div>
  <div class="foot"><span class="url">endureqr.com</span><span>Feedback welcome</span></div>
</body></html>`;

await mkdir(join(ROOT, "media"), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
const out = join(ROOT, "media/ph-teaser.jpg");
await page.screenshot({ path: out, type: "jpeg", quality: 90 });
await browser.close();
console.log(out);

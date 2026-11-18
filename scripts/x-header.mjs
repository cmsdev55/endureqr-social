#!/usr/bin/env node
/**
 * Renders the X (Twitter) profile header: media/x-header.png, 1500×500.
 *
 *   node scripts/x-header.mjs
 *
 * X covers the bottom-left with the profile photo and crops the top and bottom on phones, so the text sits
 * in the upper-middle and the art on the right. Fonts come from the site checkout, like render.mjs.
 */
import { readFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import qrcode from "qrcode-generator";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FONTS = process.env.FONTS_DIR || join(ROOT, "../stayqr/src/fonts");
const C = { bg: "#07080B", raised: "#0D0F14", ink: "#F2F4F7", muted: "#9AA3B2", subtle: "#7A8294", lime: "#B6FF3B" };
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
      m += `<rect x="${c * cell + 1.4}" y="${r * cell + 1.4}" width="${cell - 2.8}" height="${cell - 2.8}" rx="${cell * 0.22}" fill="${fill}" opacity="${lit > 0 ? 1 : 0.55}"/>`;
    }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w + 100}" height="${w + 100}" viewBox="-50 -50 ${w + 100} ${w + 100}">
    <defs><filter id="b" x="-20%" y="-400%" width="140%" height="900%"><feGaussianBlur stdDeviation="7"/></filter></defs>
    <rect x="-26" y="-26" width="${w + 52}" height="${w + 52}" rx="28" fill="${C.raised}" stroke="#fff" stroke-opacity="0.08"/>
    ${m}
    <rect x="-44" y="${scanRow * cell + cell - 3}" width="${w + 88}" height="12" fill="${C.lime}" filter="url(#b)" opacity="0.9"/>
    <rect x="-44" y="${scanRow * cell + cell + 1}" width="${w + 88}" height="4" rx="2" fill="#E6FFB8"/>
  </svg>`;
}

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:"Clash Display";font-weight:600;src:url(data:font/woff2;base64,${clash6}) format("woff2")}
  @font-face{font-family:"Inter";font-weight:100 900;src:url(data:font/woff2;base64,${inter}) format("woff2")}
  @font-face{font-family:"JetBrains Mono";font-weight:100 900;src:url(data:font/woff2;base64,${mono}) format("woff2")}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1500px;height:500px;overflow:hidden;background:${C.bg};color:${C.ink};font-family:Inter,sans-serif}
  .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:50px 50px;-webkit-mask-image:radial-gradient(ellipse 70% 90% at 78% 50%,#000 30%,transparent 75%)}
  .glow{position:absolute;right:120px;top:50%;width:520px;height:520px;transform:translateY(-50%);background:radial-gradient(circle,rgba(182,255,59,.16),transparent 65%)}
  .scene{position:absolute;right:150px;top:50%;transform:translateY(-50%) rotate(-8deg)}
  .text{position:absolute;left:110px;top:62px;width:820px}
  .eyebrow{display:inline-block;font-family:"JetBrains Mono";font-weight:500;font-size:17px;text-transform:uppercase;letter-spacing:.12em;color:${C.lime};background:rgba(182,255,59,.1);border:1px solid rgba(182,255,59,.35);padding:8px 16px;border-radius:999px;margin-bottom:26px}
  h1{font-family:"Clash Display";font-weight:600;font-size:84px;line-height:.98;letter-spacing:-.035em}
  h1 span{color:${C.lime}}
  .points{display:flex;gap:28px;margin-top:30px;font-family:"JetBrains Mono";font-size:19px;color:${C.muted};letter-spacing:.02em}
  .points b{color:${C.lime};font-weight:500;margin-right:8px}
  .url{position:absolute;right:110px;bottom:58px;font-family:"JetBrains Mono";font-size:20px;color:${C.subtle};letter-spacing:.06em}
  .url span{color:${C.lime}}
</style></head><body>
  <div class="grid"></div><div class="glow"></div>
  <div class="scene">${scene(300)}</div>
  <div class="text">
    <div class="eyebrow">Dynamic QR codes</div>
    <h1>QR codes that<br><span>keep working.</span></h1>
    <div class="points"><div><b>→</b>Edit links anytime</div><div><b>→</b>Track every scan</div><div><b>→</b>Even if you cancel</div></div>
  </div>
  <div class="url"><span>endureqr</span>.com</div>
</body></html>`;

await mkdir(join(ROOT, "media"), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 500 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
const out = join(ROOT, "media/x-header.png");
await page.screenshot({ path: out });
await browser.close();
console.log(out);

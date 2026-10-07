// One-off icon generator: renders the OpenBookMark brand SVG to the PNG
// sizes referenced by vite.config.js's manifest (icon-192/512, plus
// maskable variants with safe-zone padding so Android doesn't crop the
// book glyph when it applies a circular/squircle mask). Not part of the
// build — run manually with `node scripts/generate-icons.mjs` whenever
// the logo artwork changes.
import { chromium } from "playwright";
import { writeFileSync } from "fs";

const BG = "#F3EEDD";
const STROKE = "#1F4B3F";
const LEAF = "#8FA876";
const RIBBON = "#D4A94A";

const bookSvg = `
<svg viewBox="0 0 64 44" xmlns="http://www.w3.org/2000/svg">
  <path d="M32 10C26 6 16 4 6 5.5C4.9 5.66 4 6.6 4 7.7V34.3C4 35.6 5.2 36.5 6.4 36.2C15.6 34 25 36 32 40V10Z" fill="${BG}" stroke="${STROKE}" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M32 10C38 6 48 4 58 5.5C59.1 5.66 60 6.6 60 7.7V34.3C60 35.6 58.8 36.5 57.6 36.2C48.4 34 39 36 32 40V10Z" fill="${BG}" stroke="${STROKE}" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M32 10V40" stroke="${STROKE}" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M9 13.5C16 12.5 23 13.5 28.5 16" stroke="${LEAF}" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M9 19.5C16 18.5 23 19.5 28.5 22" stroke="${LEAF}" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M9 25.5C16 24.5 23 25.5 28.5 28" stroke="${LEAF}" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M55 13.5C48 12.5 41 13.5 35.5 16" stroke="${LEAF}" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M55 19.5C48 18.5 41 19.5 35.5 22" stroke="${LEAF}" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M32 2V13L35 10.2L38 13V2Z" fill="${RIBBON}"/>
</svg>`;

function page({ size, maskable }) {
  // Maskable icons must survive an aggressive circular/squircle crop —
  // keep all artwork inside the ~80% "safe zone" by scaling it down and
  // filling the full square with the background color (no transparency).
  const scale = maskable ? 0.68 : 0.82;
  return `<!doctype html><html><head><style>
    html,body{margin:0;padding:0;overflow:hidden;}
    .canvas{width:${size}px;height:${size}px;background:${BG};display:flex;align-items:center;justify-content:center;}
    .canvas svg{width:${Math.round(size * scale)}px;}
  </style></head><body>
    <div class="canvas">${bookSvg}</div>
  </body></html>`;
}

const targets = [
  { file: "public/icon-192.png", size: 192, maskable: false },
  { file: "public/icon-512.png", size: 512, maskable: false },
  { file: "public/icon-192-maskable.png", size: 192, maskable: true },
  { file: "public/icon-512-maskable.png", size: 512, maskable: true },
];

// This sandbox has no GPU compositor; screenshot() hangs forever without
// these flags forcing software rendering.
const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--disable-software-rasterizer"],
});
const ctx = await browser.newContext({ deviceScaleFactor: 1 });
for (const t of targets) {
  const p = await ctx.newPage();
  await p.setViewportSize({ width: t.size, height: t.size });
  await p.setContent(page(t));
  const buf = await p.screenshot({ clip: { x: 0, y: 0, width: t.size, height: t.size } });
  writeFileSync(t.file, buf);
  await p.close();
  console.log("wrote", t.file);
}
await browser.close();

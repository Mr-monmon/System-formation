/**
 * Renders the brand raster assets from the SVG mark and the site's own fonts:
 *   public/favicon-32.png, favicon-192.png, favicon-512.png, apple-touch-icon.png
 *   public/og/og-ar.png, og/og-en.png   (1200x630 social cards)
 *   public/brand/logo-full.png          (schema.org logo)
 *
 * Uses the Chromium that Playwright already has, so there is no extra
 * dependency and the type rendering matches the live site exactly.
 */
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const PINNED_CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const ar = JSON.parse(await readFile(resolve(ROOT, 'src/i18n/ar.json'), 'utf8'));
const en = JSON.parse(await readFile(resolve(ROOT, 'src/i18n/en.json'), 'utf8'));
const markSvg = await readFile(resolve(ROOT, 'public/brand/mark.svg'), 'utf8');
const markOnDark = await readFile(resolve(ROOT, 'public/brand/mark-on-dark.svg'), 'utf8');
const faviconSvg = await readFile(resolve(ROOT, 'public/favicon.svg'), 'utf8');

const fontFace = `
  @font-face {
    font-family: 'Plus Jakarta Sans';
    src: url('${resolve(ROOT, 'public/fonts/plus-jakarta-sans-latin-var.woff2')}') format('woff2');
    font-weight: 200 800;
  }
  @font-face {
    font-family: 'IBM Plex Sans Arabic';
    src: url('${resolve(ROOT, 'public/fonts/ibm-plex-sans-arabic-700.woff2')}') format('woff2');
    font-weight: 700;
  }
  @font-face {
    font-family: 'IBM Plex Sans Arabic';
    src: url('${resolve(ROOT, 'public/fonts/ibm-plex-sans-arabic-400.woff2')}') format('woff2');
    font-weight: 400;
  }`;

/** Faint hexagonal lattice, same motif the dark sections use. */
function lattice(cols = 16, rows = 7) {
  const W = 92;
  const H = 80;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = c * W * 0.75 + W / 2;
      const cy = r * H + (c % 2 ? H / 2 : 0) + H / 2;
      const points = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 180) * (60 * i);
        return `${(cx + (W / 2) * Math.cos(a)).toFixed(1)},${(cy + (H / 2) * Math.sin(a)).toFixed(1)}`;
      }).join(' ');
      cells.push(`<polygon points="${points}" />`);
    }
  }
  return `<svg class="lattice" viewBox="0 0 ${cols * W * 0.75} ${rows * H}" preserveAspectRatio="xMidYMid slice">${cells.join('')}</svg>`;
}

const ogHtml = (lang) => {
  const copy = lang === 'ar' ? ar : en;
  const rtl = lang === 'ar';
  return `<!doctype html><html lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>
    ${fontFace}
    * { margin: 0; box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #0F1E32; }
    .card {
      width: 1200px; height: 630px; overflow: hidden; position: relative;
      background: #0F1E32; color: #fff;
      font-family: ${rtl ? "'IBM Plex Sans Arabic'" : "'Plus Jakarta Sans'"}, sans-serif;
      display: flex; flex-direction: column; justify-content: space-between;
      padding: 76px 84px;
    }
    .card::after {
      content: ''; position: absolute; inset-inline-end: -8%; inset-block-start: -22%;
      width: 60%; height: 100%;
      background: radial-gradient(circle at 60% 40%, rgba(18,163,253,.22), transparent 62%);
    }
    .lattice { position: absolute; inset: 0; width: 100%; height: 100%; opacity: .16; }
    .lattice polygon { fill: none; stroke: #12A3FD; stroke-width: 1.2; }
    .row { position: relative; z-index: 1; display: flex; align-items: center; gap: 22px; }
    .mark { width: 74px; }
    .mark svg { width: 100%; height: auto; display: block; }
    .word { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 800; font-size: 34px; line-height: 1.02; letter-spacing: -.03em; }
    h1 {
      position: relative; z-index: 1;
      font-size: ${rtl ? '60px' : '64px'};
      font-weight: ${rtl ? 700 : 800};
      line-height: ${rtl ? 1.35 : 1.1};
      letter-spacing: ${rtl ? '0' : '-.022em'};
      max-width: ${rtl ? '20ch' : '18ch'};
    }
    .foot { position: relative; z-index: 1; display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; }
    .foot p { color: #A9BBD6; font-size: 24px; }
    .url { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 600; color: #12A3FD; font-size: 24px; direction: ltr; }
  </style></head><body><div class="card">
    ${lattice()}
    <div class="row">
      <span class="mark">${markOnDark}</span>
      <span class="word">System<br>Formation</span>
    </div>
    <h1>${copy.meta.tagline}</h1>
    <div class="foot">
      <p>${copy.footer.description}</p>
      <span class="url">systemformation.com</span>
    </div>
  </div></body></html>`;
};

const lockupHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
  ${fontFace}
  * { margin: 0; box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .card { width: 1000px; height: 452px; overflow: hidden; background: #fff; display: flex; align-items: center; gap: 40px; padding: 60px; font-family: 'Plus Jakarta Sans', sans-serif; }
  .mark { width: 258px; }
  .mark svg { width: 100%; height: auto; display: block; }
  .word { font-weight: 800; font-size: 96px; line-height: .98; letter-spacing: -.035em; color: #0B1B33; }
  .sub { font-weight: 600; font-size: 44px; color: #4E5561; margin-top: 8px; letter-spacing: -.01em; }
  .arname { font-family: 'IBM Plex Sans Arabic', sans-serif; font-weight: 400; font-size: 30px; color: #4E5561; margin-top: 10px; direction: rtl; }
</style></head><body><div class="card">
  <span class="mark">${markSvg}</span>
  <div>
    <div class="word">System<br>Formation</div>
    <div class="sub">Co. Ltd</div>
    <div class="arname">شركة تشكيل النظم المحدودة</div>
  </div>
</div></body></html>`;

const browser = await chromium.launch(
  existsSync(PINNED_CHROME) ? { executablePath: PINNED_CHROME } : {},
);

async function shoot(html, { width, height, out, scale = 1, transparent = false }) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: scale,
  });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const card = page.locator('.card');
  const target = (await card.count()) ? card : page;
  const buffer = await target.screenshot({ omitBackground: transparent });
  await writeFile(resolve(ROOT, out), buffer);
  await page.close();
  console.log(`[og] ${out} (${width * scale}x${height * scale})`);
}

const iconHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;width:256px;height:256px;overflow:hidden}
  svg{width:256px;height:256px;display:block}
</style></head><body>${faviconSvg}</body></html>`;

await mkdir(resolve(ROOT, 'public/og'), { recursive: true });

for (const [size, name] of [
  [32, 'public/favicon-32.png'],
  [180, 'public/apple-touch-icon.png'],
  [192, 'public/favicon-192.png'],
  [512, 'public/favicon-512.png'],
]) {
  await shoot(iconHtml, { width: 256, height: 256, out: name, scale: size / 256 });
}

await shoot(ogHtml('ar'), { width: 1200, height: 630, out: 'public/og/og-ar.png' });
await shoot(ogHtml('en'), { width: 1200, height: 630, out: 'public/og/og-en.png' });
await shoot(lockupHtml, { width: 1000, height: 452, out: 'public/brand/logo-full.png' });

await browser.close();
console.log('[og] done');

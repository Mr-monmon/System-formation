/**
 * Review pass.
 *
 * Two passes, because they answer different questions:
 *   A. motion on, viewport-sized  — is the hero sequence right, does the fold read
 *   B. reduced motion, full page  — layout, RTL mirroring, typography, overflow
 *
 * Full-page capture under normal motion is useless here: Lenis owns the scroll
 * and Playwright's full-page resize re-fires every ScrollTrigger.
 *
 * Writes to .review/ (git-ignored). BASE_URL overrides the server.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4321';
const PINNED = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = '.review';

const widths = [
  { name: '375', width: 375, height: 812 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 900 },
  { name: '1920', width: 1920, height: 1080 },
];
const pages = ['', 'partner-model/', 'services/', 'compliance/', 'about/', 'contact/', 'privacy/', 'terms/', '404/'];
const langs = ['ar', 'en'];
const filter = process.argv.slice(2);
const wanted = (lang, slug) => !filter.length || filter.some((f) => `${lang}/${slug}`.includes(f));

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch(existsSync(PINNED) ? { executablePath: PINNED } : {});

/** Reports anything sticking out of the viewport that is not inside a clip. */
const overflowProbe = () => {
  const limit = document.documentElement.clientWidth;
  const clipped = (el) => {
    let node = el.parentElement;
    while (node && node !== document.body) {
      if (/hidden|clip|auto|scroll/.test(getComputedStyle(node).overflowX)) return true;
      node = node.parentElement;
    }
    return false;
  };
  const offenders = new Set();
  document.querySelectorAll('body *').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || clipped(el)) return;
    if (r.right > limit + 1.5 || r.left < -1.5) {
      const cls = typeof el.className === 'string' ? el.className.split(' ')[0] : '';
      offenders.add(`${el.tagName.toLowerCase()}.${cls}`);
    }
  });
  const hidden = [...document.querySelectorAll('[data-animate], [data-stagger] > *')].filter(
    (el) => Number(getComputedStyle(el).opacity) === 0,
  ).length;
  return {
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: limit,
    offenders: [...offenders].slice(0, 5),
    hidden,
  };
};

async function capture(context, { lang, slug, size, tag, fullPage }) {
  const page = await context.newPage();
  await page.setViewportSize({ width: size.width, height: size.height });
  const response = await page.goto(`${BASE}/${lang}/${slug}`, { waitUntil: 'networkidle' });
  if (!response || response.status() >= 400) console.error(`  !! ${lang}/${slug} -> ${response?.status()}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(fullPage ? 400 : 2200);

  const probe = await page.evaluate(overflowProbe);
  await page.screenshot({ path: `${OUT}/${tag}.png`, fullPage });

  const warn = [
    probe.scrollWidth > probe.clientWidth + 1 ? `scrollW=${probe.scrollWidth}/${probe.clientWidth}` : '',
    probe.offenders.length ? `overflow: ${probe.offenders.join(', ')}` : '',
    fullPage && probe.hidden ? `hidden: ${probe.hidden}` : '',
  ].filter(Boolean);
  console.log(`${tag}${warn.length ? '  ⚠ ' + warn.join(' | ') : ''}`);
  await page.close();
}

// --- Pass A: motion on, above the fold, every width ------------------------
const motion = await browser.newContext({ reducedMotion: 'no-preference' });
for (const lang of langs) {
  for (const slug of pages) {
    if (!wanted(lang, slug)) continue;
    for (const size of widths) {
      await capture(motion, {
        lang, slug, size,
        tag: `${lang}-${slug.replace(/\/$/, '') || 'home'}-${size.name}`,
        fullPage: false,
      });
    }
  }
}
await motion.close();

// --- Pass B: reduced motion, whole page, desktop and mobile ----------------
const still = await browser.newContext({ reducedMotion: 'reduce' });
for (const lang of langs) {
  for (const slug of pages) {
    if (!wanted(lang, slug)) continue;
    for (const size of widths.filter((w) => w.name === '375' || w.name === '1280')) {
      await capture(still, {
        lang, slug, size,
        tag: `${lang}-${slug.replace(/\/$/, '') || 'home'}-${size.name}-full`,
        fullPage: true,
      });
    }
  }
}
await still.close();

await browser.close();
console.log(`\nscreenshots in ${OUT}`);

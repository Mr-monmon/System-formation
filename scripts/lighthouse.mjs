/** Lighthouse for /ar/ and /en/, mobile and desktop. Needs a server on BASE_URL. */
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:4321';
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const dir = mkdtempSync(join(tmpdir(), 'lh-'));
const urls = process.env.LH_URLS?.split(',') ?? ['/ar/', '/en/'];
const rows = [];

for (const path of urls) {
  for (const preset of ['mobile', 'desktop']) {
    const out = join(dir, `${path.replace(/\//g, '_')}-${preset}.json`);
    execFileSync(
      'npx',
      [
        'lighthouse', BASE + path,
        '--quiet', '--output=json', `--output-path=${out}`,
        `--preset=${preset === 'desktop' ? 'desktop' : 'perf'}`,
        ...(preset === 'mobile' ? ['--form-factor=mobile'] : []),
        '--only-categories=performance,accessibility,best-practices,seo',
        '--chrome-flags=--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage',
        '--max-wait-for-load=45000',
      ],
      { stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, CHROME_PATH: CHROME } },
    );
    const report = JSON.parse(readFileSync(out, 'utf8'));
    const score = (id) => Math.round((report.categories[id]?.score ?? 0) * 100);
    const audit = (id) => report.audits[id]?.displayValue ?? '—';
    rows.push({
      url: path,
      preset,
      perf: score('performance'),
      a11y: score('accessibility'),
      bp: score('best-practices'),
      seo: score('seo'),
      lcp: audit('largest-contentful-paint'),
      cls: audit('cumulative-layout-shift'),
      tbt: audit('total-blocking-time'),
    });
    const failed = Object.values(report.audits).filter(
      (a) => a.score !== null && a.score < 1 && ['accessibility', 'seo'].some((c) =>
        report.categories[c].auditRefs.some((r) => r.id === a.id)),
    );
    if (failed.length) {
      console.log(`\n  ${path} ${preset} — a11y/SEO audits not passing:`);
      failed.forEach((a) => console.log(`    - ${a.id}: ${a.title}`));
    }
  }
}

console.log('\n| URL | Preset | Perf | A11y | Best practices | SEO | LCP | CLS | TBT |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  console.log(`| ${r.url} | ${r.preset} | ${r.perf} | ${r.a11y} | ${r.bp} | ${r.seo} | ${r.lcp} | ${r.cls} | ${r.tbt} |`);
}

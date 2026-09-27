/**
 * /llms.txt — a plain-language map of the site for AI assistants and answer
 * engines (llmstxt.org). Built from the same copy as the pages, so it can never
 * drift from what the site says. Placeholders are left out.
 */
import type { APIRoute } from 'astro';
import { t, path, type Locale, type RouteKey } from '../i18n';
import { answerText } from '../seo/faq';

const PAGES: RouteKey[] = ['home', 'partner', 'services', 'compliance', 'about', 'faq', 'contact'];

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://tashkeeltech.com');
  const abs = (p: string) => new URL(p, base).href;
  const en = t('en');
  const ar = t('ar');

  const pageList = (lang: Locale) => {
    const copy = t(lang) as unknown as Record<string, { seo: { title: string; description: string } }>;
    const nav = t(lang).nav as Record<string, string>;
    return PAGES.map((route) => `- [${nav[route]}](${abs(path(lang, route))}): ${copy[route].seo.description}`);
  };

  const serviceList = (lang: Locale) => {
    const copy = t(lang);
    const url = abs(path(lang, 'services'));
    return [copy.services.providers, copy.services.organisations].flatMap((group) => [
      '',
      `### ${group.title}`,
      '',
      ...group.items.map((s) => `- [${s.name}](${url}#${s.id}): ${s.text}`),
    ]);
  };

  const frameworks = en.compliance.groups.flatMap((g) =>
    g.items.map((i) => `- ${i.code} — ${i.name} (${g.regulator})`),
  );

  const faq = en.faq.items.map((i) => `- **${i.q}** ${answerText(i.a, en)}`);

  const body = [
    '# tashkeel tech (تشكيل)',
    '',
    `> ${en.footer.description} ${en.about.hero.sub}`,
    '',
    `- Legal name: ${en.meta.siteNameLegal} — شركة تشكيل النظم المحدودة`,
    '- Country: Kingdom of Saudi Arabia; delivery in Arabic and English',
    `- Website: ${abs('/')} (Arabic at ${abs('/ar/')}, English at ${abs('/en/')})`,
    `- Email: ${en.common.email}`,
    `- Phone: ${en.common.phoneDisplay}`,
    `- Address: ${en.common.address} (${ar.common.address})`,
    `- Savings claim: ${en.home.savings.cap} of operating cost for service providers. ${en.home.savings.footnote}`,
    `- ${en.compliance.disclaimer}`,
    '',
    '## Pages (English)',
    '',
    ...pageList('en'),
    '',
    '## Services',
    ...serviceList('en'),
    '',
    '## Frameworks we work to',
    '',
    ...frameworks,
    '',
    '## Frequently asked questions',
    '',
    ...faq,
    '',
    '## الصفحات بالعربية',
    '',
    ...pageList('ar'),
    '',
    '## الخدمات',
    ...serviceList('ar'),
    '',
    '## Optional',
    '',
    `- [${en.footer.privacy}](${abs(path('en', 'privacy'))}): ${en.privacy.seo.description}`,
    `- [${en.footer.terms}](${abs(path('en', 'terms'))}): ${en.terms.seo.description}`,
    `- [${ar.footer.privacy}](${abs(path('ar', 'privacy'))})`,
    `- [${ar.footer.terms}](${abs(path('ar', 'terms'))})`,
    '',
  ].join('\n');

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};

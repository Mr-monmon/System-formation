/**
 * Structured data (schema.org JSON-LD) for every page, as one @graph.
 *
 * Search engines and AI assistants read this to know, without guessing, who
 * the company is, what each page is, and how the pages relate. Nodes refer to
 * each other by @id, so the Organization is described once and every page
 * points at it.
 *
 * Rules:
 *   - Everything here restates what the visible page already says. Nothing is
 *     added that a reader cannot see.
 *   - Placeholders ([ANALYST COST] ...) are never emitted. Add sameAs profiles
 *     once they exist.
 */
import { t, path, type Locale, type RouteKey } from '../i18n';
import { answerText } from './faq';

interface PageInput {
  lang: Locale;
  route: RouteKey;
  title: string;
  description: string;
  site: URL;
  /** Pages that should not be indexed get the site-level nodes only. */
  noindex?: boolean;
}

const PAGE_TYPE: Partial<Record<RouteKey, string | string[]>> = {
  about: 'AboutPage',
  contact: 'ContactPage',
  faq: ['WebPage', 'FAQPage'],
};

export function buildGraph({ lang, route, title, description, site, noindex = false }: PageInput) {
  const copy = t(lang);
  const abs = (p: string) => new URL(p, site).href;
  const root = abs('/');
  const ids = {
    org: `${root}#organization`,
    site: `${root}#website`,
    logo: `${root}#logo`,
  };
  const country = {
    '@type': 'Country',
    name: lang === 'ar' ? 'المملكة العربية السعودية' : 'Saudi Arabia',
  };

  const services = [...copy.services.providers.items, ...copy.services.organisations.items];
  const frameworks = copy.compliance.groups.flatMap((g) => g.items.map((i) => `${i.name} (${i.code})`));

  const organization = {
    '@type': 'Organization',
    '@id': ids.org,
    name: 'tashkeel tech',
    alternateName: ['تشكيل', 'Tashkeel Tech', 'شركة تشكيل النظم المحدودة'],
    legalName: 'System Formation Co. Ltd',
    url: root,
    logo: {
      '@type': 'ImageObject',
      '@id': ids.logo,
      url: abs('/brand/logo/lockup-en-on-light.png'),
      width: 1335,
      height: 506,
      caption: 'tashkeel tech',
    },
    image: { '@id': ids.logo },
    slogan: copy.meta.tagline,
    description: copy.footer.description,
    email: copy.common.email,
    telephone: copy.common.phoneDial,
    address: {
      '@type': 'PostalAddress',
      streetAddress: lang === 'ar' ? 'شارع العليا' : 'Olaya Street',
      addressLocality: lang === 'ar' ? 'الرياض' : 'Riyadh',
      addressRegion: lang === 'ar' ? 'منطقة الرياض' : 'Riyadh Region',
      addressCountry: 'SA',
    },
    areaServed: country,
    knowsAbout: [...services.map((s) => s.name), ...frameworks],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales',
      email: copy.common.email,
      telephone: copy.common.phoneDial,
      areaServed: 'SA',
      availableLanguage: ['Arabic', 'English'],
    },
    // Add social profiles here once they exist; an empty sameAs is just noise.
  };

  const website = {
    '@type': 'WebSite',
    '@id': ids.site,
    url: root,
    name: 'tashkeel tech',
    alternateName: 'تشكيل',
    inLanguage: ['ar-SA', 'en'],
    publisher: { '@id': ids.org },
  };

  const graph: Record<string, unknown>[] = [organization, website];
  if (noindex) return { '@context': 'https://schema.org', '@graph': graph };

  const url = abs(path(lang, route));
  const pageId = `${url}#webpage`;
  const webpage: Record<string, unknown> = {
    '@type': PAGE_TYPE[route] ?? 'WebPage',
    '@id': pageId,
    url,
    name: title,
    description,
    inLanguage: lang === 'ar' ? 'ar-SA' : 'en',
    isPartOf: { '@id': ids.site },
    about: { '@id': ids.org },
    primaryImageOfPage: { '@type': 'ImageObject', url: abs('/og/og-image.png'), width: 1200, height: 630 },
  };
  graph.push(webpage);

  if (route !== 'home') {
    const labels: Record<string, string> = {
      ...(copy.nav as Record<string, string>),
      privacy: copy.footer.privacy,
      terms: copy.footer.terms,
    };
    const breadcrumbId = `${url}#breadcrumb`;
    webpage.breadcrumb = { '@id': breadcrumbId };
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': breadcrumbId,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: copy.nav.home, item: abs(path(lang, 'home')) },
        { '@type': 'ListItem', position: 2, name: labels[route] ?? title, item: url },
      ],
    });
  }

  if (route === 'services') {
    const catalogId = `${url}#services`;
    const offers = (items: typeof services) =>
      items.map((s) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          '@id': `${url}#${s.id}`,
          name: s.name,
          description: s.text,
          url: `${url}#${s.id}`,
          provider: { '@id': ids.org },
          areaServed: country,
        },
      }));
    webpage.mainEntity = { '@id': catalogId };
    graph.push({
      '@type': 'OfferCatalog',
      '@id': catalogId,
      name: copy.nav.services,
      itemListElement: [
        {
          '@type': 'OfferCatalog',
          name: copy.services.providers.title,
          itemListElement: offers(copy.services.providers.items),
        },
        {
          '@type': 'OfferCatalog',
          name: copy.services.organisations.title,
          itemListElement: offers(copy.services.organisations.items),
        },
      ],
    });
  }

  if (route === 'faq') {
    webpage.mainEntity = copy.faq.items.map((item) => ({
      '@type': 'Question',
      '@id': `${url}#${item.id}`,
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: answerText(item.a, copy) },
    }));
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}

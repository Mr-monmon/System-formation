import ar from './ar.json';
import en from './en.json';

export const locales = ['ar', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ar';

const dictionaries = { ar, en } as const;

/** Every string on the site comes from ar.json / en.json — never from a component. */
export function t(lang: Locale): typeof en {
  return dictionaries[lang] as unknown as typeof en;
}

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export const dir = (lang: Locale) => (lang === 'ar' ? 'rtl' : 'ltr');
export const otherLocale = (lang: Locale): Locale => (lang === 'ar' ? 'en' : 'ar');

/**
 * Route slugs are shared between languages so the language switch can stay on
 * the same page, and so URLs never need percent-encoding.
 */
export const routes = {
  home: '',
  partner: 'partner-model',
  services: 'services',
  compliance: 'compliance',
  about: 'about',
  contact: 'contact',
  privacy: 'privacy',
  terms: 'terms',
} as const;

export type RouteKey = keyof typeof routes;

/** Locale-prefixed, always with a trailing slash to match the build output. */
export function path(lang: Locale, route: RouteKey | string = 'home'): string {
  const slug = route in routes ? routes[route as RouteKey] : String(route);
  return slug ? `/${lang}/${slug}/` : `/${lang}/`;
}

/** The same page in the other language, for the header switch and hreflang. */
export function alternates(route: RouteKey) {
  return locales.map((l) => ({ lang: l, href: path(l, route) }));
}

/** Main navigation, in order. */
export const navRoutes: RouteKey[] = ['home', 'partner', 'services', 'compliance', 'about', 'contact'];

/** Formats an integer with Western Arabic digits and thin grouping, in both languages. */
export function formatNumber(value: number, lang: Locale): string {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-GB', {
    maximumFractionDigits: 0,
  }).format(value);
}

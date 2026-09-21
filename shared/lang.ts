/** Language negotiation for the bare "/" route. */
export const LOCALES = ['ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ar';
export const LANG_COOKIE = 'sf-lang';

/**
 * Arabic is the default; English wins only when the browser actually prefers
 * it. Quality values are honoured, so "en;q=0.9, ar;q=0.8" resolves to English.
 */
export function preferredLocale(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;

  let best: { locale: Locale; q: number } | null = null;
  for (const part of header.split(',')) {
    const [tagRaw, ...params] = part.trim().split(';');
    const tag = tagRaw.trim().toLowerCase();
    if (!tag) continue;

    const qParam = params.find((p) => p.trim().startsWith('q='));
    const q = qParam ? Number.parseFloat(qParam.split('=')[1]) : 1;
    if (Number.isNaN(q) || q <= 0) continue;

    const base = tag.split('-')[0];
    const locale: Locale | null =
      base === 'ar' ? 'ar' : base === 'en' ? 'en' : tag === '*' ? DEFAULT_LOCALE : null;
    if (!locale) continue;
    if (!best || q > best.q) best = { locale, q };
  }
  return best?.locale ?? DEFAULT_LOCALE;
}

export function isLocale(value: string | null): value is Locale {
  return value !== null && (LOCALES as readonly string[]).includes(value);
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const pair of header.split(';')) {
    const index = pair.indexOf('=');
    if (index < 0) continue;
    if (pair.slice(0, index).trim() === name) return pair.slice(index + 1).trim();
  }
  return null;
}

/** 302 to /ar/ or /en/, honouring an explicit choice stored in the cookie. */
export function redirectToLocale(request: Request): Response {
  const url = new URL(request.url);
  const cookie = readCookie(request.headers.get('cookie'), LANG_COOKIE);
  const chosen = isLocale(cookie) ? cookie : preferredLocale(request.headers.get('accept-language'));

  const target = new URL(`/${chosen}/`, url);
  target.search = url.search;

  return new Response(null, {
    status: 302,
    headers: {
      location: target.toString(),
      // The answer depends on both signals, so caches must not share one.
      vary: 'Accept-Language, Cookie',
      'cache-control': 'no-store',
    },
  });
}

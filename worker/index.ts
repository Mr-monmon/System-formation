/**
 * System Formation — Cloudflare Worker.
 *
 * Static pages are served straight from the assets binding; this script only
 * owns two things (see assets.run_worker_first in wrangler.jsonc):
 *
 *   GET  /            language negotiation -> /ar/ or /en/
 *   POST /api/contact validated, rate-limited, Turnstile-checked contact form
 *
 * Security headers on ASSET responses come from public/_headers. That file does
 * not apply to responses generated here, so this script sets its own.
 */

export interface Env {
  ASSETS: Fetcher;
  CONTACT_RATE_LIMIT?: RateLimit;
  TURNSTILE_SECRET_KEY?: string;
  RESEND_API_KEY?: string;
  CONTACT_TO?: string;
  CONTACT_FROM?: string;
}

interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

const LOCALES = ['ar', 'en'] as const;
type Locale = (typeof LOCALES)[number];
const DEFAULT_LOCALE: Locale = 'ar';
const LANG_COOKIE = 'sf-lang';

const SECURITY_HEADERS: Record<string, string> = {
  'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()',
  'content-security-policy':
    "default-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/contact') {
      return withSecurity(await handleContact(request, env, ctx));
    }

    if (url.pathname === '/' || url.pathname === '') {
      return withSecurity(redirectToLocale(request, url));
    }

    // Anything else reaching the Worker falls through to the static assets.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

/* ------------------------------------------------------------------ */
/* Language negotiation                                                */
/* ------------------------------------------------------------------ */
function redirectToLocale(request: Request, url: URL): Response {
  const cookie = readCookie(request.headers.get('cookie'), LANG_COOKIE);
  const chosen = isLocale(cookie)
    ? cookie
    : preferredLocale(request.headers.get('accept-language'));

  const target = new URL(`/${chosen}/`, url);
  target.search = url.search;

  return new Response(null, {
    status: 302,
    headers: {
      location: target.toString(),
      // The choice depends on both signals, so caches must not share one answer.
      vary: 'Accept-Language, Cookie',
      'cache-control': 'no-store',
    },
  });
}

/**
 * Arabic is the default; English wins only when the browser actually prefers it.
 * Quality values are honoured so "en;q=0.9, ar;q=0.8" resolves to English.
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
    const locale: Locale | null = base === 'ar' ? 'ar' : base === 'en' ? 'en' : tag === '*' ? DEFAULT_LOCALE : null;
    if (!locale) continue;
    if (!best || q > best.q) best = { locale, q };
  }
  return best?.locale ?? DEFAULT_LOCALE;
}

function isLocale(value: string | null): value is Locale {
  return value !== null && (LOCALES as readonly string[]).includes(value);
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const pair of header.split(';')) {
    const index = pair.indexOf('=');
    if (index < 0) continue;
    if (pair.slice(0, index).trim() === name) return pair.slice(index + 1).trim();
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Contact endpoint                                                    */
/* ------------------------------------------------------------------ */
const LIMITS = {
  name: 120,
  company: 160,
  email: 180,
  phone: 40,
  role: 80,
  interest: 160,
  message: 4000,
} as const;

interface ContactPayload {
  name: string;
  company: string;
  email: string;
  phone: string;
  role: string;
  interest: string;
  message: string;
  locale: string;
  website?: string;
  'cf-turnstile-response'?: string;
}

async function handleContact(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'POST' } });
  if (request.method !== 'POST') return json({ ok: false, error: 'server' }, 405, { allow: 'POST' });

  // Same-origin only: the form is never meant to be posted from elsewhere.
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return json({ ok: false, error: 'server' }, 403);
  }

  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (env.CONTACT_RATE_LIMIT) {
    const { success } = await env.CONTACT_RATE_LIMIT.limit({ key: `contact:${ip}` });
    if (!success) return json({ ok: false, error: 'rate' }, 429);
  }

  let body: Partial<ContactPayload>;
  try {
    body = await readBody(request);
  } catch {
    return json({ ok: false, error: 'server' }, 400);
  }

  // Honeypot: only a bot fills this in. Answer 200 so it learns nothing.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return json({ ok: true });
  }

  const name = clean(body.name);
  const email = clean(body.email);
  const message = clean(body.message);

  const locale = clean(body.locale) === 'en' ? 'en' : 'ar';
  const wantsHtml = prefersHtml(request);
  const fail = (error: string, status: number, field?: string) =>
    wantsHtml ? htmlResult(false, locale, status) : json({ ok: false, error, field }, status);

  if (name.length < 2) return fail('name', 422, 'name');
  if (!isEmail(email)) return fail('email', 422, 'email');
  if (message.length < 10) return fail('message', 422, 'message');

  for (const [field, max] of Object.entries(LIMITS) as [keyof typeof LIMITS, number][]) {
    if (clean(body[field]).length > max) {
      return fail('tooLong', 422, field);
    }
  }

  if (env.TURNSTILE_SECRET_KEY) {
    const token = typeof body['cf-turnstile-response'] === 'string' ? body['cf-turnstile-response'] : '';
    const passed = await verifyTurnstile(token, ip, env.TURNSTILE_SECRET_KEY);
    if (!passed) return fail('captcha', 403);
  }

  const submission = {
    name,
    company: clean(body.company),
    email,
    phone: clean(body.phone),
    role: clean(body.role),
    interest: clean(body.interest),
    message,
    locale,
    receivedAt: new Date().toISOString(),
    ip,
  };

  const delivery = await deliver(submission, env);
  if (!delivery.ok) {
    // Never drop a message silently: log it for the tail, and tell the visitor
    // to use the address and WhatsApp link the form shows underneath.
    console.error('contact delivery failed', {
      reason: delivery.reason,
      from: submission.email,
      at: submission.receivedAt,
    });
    return fail('server', 502);
  }

  return wantsHtml ? htmlResult(true, locale, 200) : json({ ok: true });
}

/** A browser posting the form directly (no JavaScript) asks for HTML. */
function prefersHtml(request: Request): boolean {
  const accept = request.headers.get('accept') ?? '';
  if (accept.includes('application/json')) return false;
  return accept.includes('text/html');
}

/**
 * Without JavaScript the form posts straight here, so the answer has to be a
 * readable page rather than a JSON body. Kept deliberately small and inline —
 * it is a fallback, not a route of the site.
 */
function htmlResult(ok: boolean, locale: string, status: number): Response {
  const ar = locale === 'ar';
  const copy = ok
    ? {
        title: ar ? 'تم إرسال رسالتك.' : 'Message sent.',
        body: ar ? 'نرد خلال يوم عمل واحد.' : 'We reply within one business day.',
      }
    : {
        title: ar ? 'لم تُرسل الرسالة.' : 'The message did not send.',
        body: ar
          ? 'راسلنا مباشرة على info@systemformation.com أو عبر واتساب، ولن تضيع رسالتك.'
          : 'Email info@systemformation.com or message us on WhatsApp instead — your message is not lost.',
      };
  const back = ar ? 'العودة إلى الموقع' : 'Back to the site';

  const page = `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${copy.title}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
 body{margin:0;min-height:100svh;display:grid;place-items:center;padding:2rem;
      background:#0F1E32;color:#fff;font:400 1rem/1.7 system-ui,sans-serif;text-align:center}
 main{max-width:34rem}
 h1{font-size:1.75rem;margin:0 0 .75rem}
 p{color:#A9BBD6;margin:0 0 2rem}
 a{display:inline-block;padding:.85rem 1.6rem;border-radius:10px;
   background:#0054DE;color:#fff;text-decoration:none;font-weight:600}
 a:hover{background:#0047BE}
</style>
</head>
<body><main>
<h1>${copy.title}</h1>
<p>${copy.body}</p>
<a href="/${ar ? 'ar' : 'en'}/contact/">${back}</a>
</main></body></html>`;

  return new Response(page, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      // _headers does not reach Worker responses, so this page carries its own.
      'content-security-policy':
        "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    },
  });
}

async function readBody(request: Request): Promise<Partial<ContactPayload>> {
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('application/json')) {
    return (await request.json()) as Partial<ContactPayload>;
  }
  // A no-JS submit posts the form directly.
  const form = await request.formData();
  return Object.fromEntries(form.entries()) as unknown as Partial<ContactPayload>;
}

const clean = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim() : '';

const isEmail = (value: string): boolean =>
  value.length <= LIMITS.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

async function verifyTurnstile(token: string, ip: string, secret: string): Promise<boolean> {
  if (!token) return false;
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
    });
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}

type Submission = {
  name: string;
  company: string;
  email: string;
  phone: string;
  role: string;
  interest: string;
  message: string;
  locale: string;
  receivedAt: string;
  ip: string;
};

/**
 * Delivery is pluggable. Resend is wired up because it is GA and works from a
 * Worker over plain HTTPS; Cloudflare's own send_email binding is the other
 * option and is documented in the README.
 */
async function deliver(submission: Submission, env: Env): Promise<{ ok: boolean; reason?: string }> {
  const to = env.CONTACT_TO ?? 'info@systemformation.com';

  if (!env.RESEND_API_KEY) {
    return { ok: false, reason: 'no delivery configured' };
  }

  const lines = [
    `Name:     ${submission.name}`,
    `Company:  ${submission.company || '—'}`,
    `Email:    ${submission.email}`,
    `Phone:    ${submission.phone || '—'}`,
    `Type:     ${submission.role || '—'}`,
    `Interest: ${submission.interest || '—'}`,
    `Language: ${submission.locale}`,
    `Received: ${submission.receivedAt}`,
    '',
    submission.message,
  ].join('\n');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.CONTACT_FROM ?? 'System Formation <website@systemformation.com>',
        to: [to],
        reply_to: submission.email,
        subject: `Website enquiry — ${submission.name}${submission.company ? ` (${submission.company})` : ''}`,
        text: lines,
      }),
    });
    if (!response.ok) {
      return { ok: false, reason: `resend ${response.status}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: String(error) };
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });
}

function withSecurity(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

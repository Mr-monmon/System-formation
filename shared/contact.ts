/**
 * The contact endpoint, shared by the Pages Function and the Worker.
 *
 * Layers, in order: same-origin check, rate limit (Workers binding where it
 * exists, a WAF rule on Pages), honeypot, server-side validation, Turnstile,
 * then delivery. A message is never silently dropped: if delivery is not
 * configured or fails, it is logged and the caller is told to use the email
 * address and WhatsApp link the form shows underneath.
 */
import type { Env } from './env';
import { INLINE_PAGE_CSP } from './security';

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

interface Submission {
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
}

export async function handleContact(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { allow: 'POST' } });
  }
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'server' }, 405, { allow: 'POST' });
  }

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
    if (clean(body[field]).length > max) return fail('tooLong', 422, field);
  }

  if (env.TURNSTILE_SECRET_KEY) {
    const token = typeof body['cf-turnstile-response'] === 'string' ? body['cf-turnstile-response'] : '';
    if (!(await verifyTurnstile(token, ip, env.TURNSTILE_SECRET_KEY))) {
      return fail('captcha', 403);
    }
  }

  const submission: Submission = {
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
    console.error('contact delivery failed', {
      reason: delivery.reason,
      from: submission.email,
      at: submission.receivedAt,
    });
    return fail('server', 502);
  }

  return wantsHtml ? htmlResult(true, locale, 200) : json({ ok: true });
}

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */
async function readBody(request: Request): Promise<Partial<ContactPayload>> {
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('application/json')) {
    return (await request.json()) as Partial<ContactPayload>;
  }
  // A no-JavaScript submit posts the form directly.
  const form = await request.formData();
  return Object.fromEntries(form.entries()) as unknown as Partial<ContactPayload>;
}

const clean = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim() : '';

const isEmail = (value: string): boolean =>
  value.length <= LIMITS.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

/** A browser posting the form directly (no JavaScript) asks for HTML. */
function prefersHtml(request: Request): boolean {
  const accept = request.headers.get('accept') ?? '';
  if (accept.includes('application/json')) return false;
  return accept.includes('text/html');
}

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

/* ------------------------------------------------------------------ */
/* Delivery — Resend                                                   */
/* ------------------------------------------------------------------ */
async function deliver(submission: Submission, env: Env): Promise<{ ok: boolean; reason?: string }> {
  if (!env.RESEND_API_KEY) {
    return { ok: false, reason: 'RESEND_API_KEY is not set' };
  }

  const to = env.CONTACT_TO ?? 'info@systemformation.com';
  const from = env.CONTACT_FROM ?? 'System Formation <website@systemformation.com>';
  const label = (en: string, ar: string) => (submission.locale === 'ar' ? ar : en);

  const text = [
    `${label('Name', 'الاسم')}: ${submission.name}`,
    `${label('Company', 'جهة العمل')}: ${submission.company || '—'}`,
    `${label('Email', 'البريد')}: ${submission.email}`,
    `${label('Phone', 'الهاتف')}: ${submission.phone || '—'}`,
    `${label('Type', 'الفئة')}: ${submission.role || '—'}`,
    `${label('Interest', 'الاهتمام')}: ${submission.interest || '—'}`,
    `${label('Language', 'اللغة')}: ${submission.locale}`,
    `${label('Received', 'وقت الاستلام')}: ${submission.receivedAt}`,
    '',
    submission.message,
  ].join('\n');

  // RESEND_API_BASE exists so the outbound payload can be asserted against a
  // local mock in tests; production never sets it.
  const endpoint = `${env.RESEND_API_BASE ?? 'https://api.resend.com'}/emails`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        // Replying to the notification replies to the enquirer.
        reply_to: submission.email,
        subject: `Website enquiry — ${submission.name}${submission.company ? ` (${submission.company})` : ''}`,
        text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      return { ok: false, reason: `resend ${response.status}: ${detail.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: String(error) };
  }
}

/* ------------------------------------------------------------------ */
/* Output                                                              */
/* ------------------------------------------------------------------ */
function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extra,
    },
  });
}

/**
 * Without JavaScript the form posts straight here, so the answer has to be a
 * readable page rather than a JSON body. Deliberately small and inline — it is
 * a fallback, not a route of the site.
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
      'content-security-policy': INLINE_PAGE_CSP,
    },
  });
}

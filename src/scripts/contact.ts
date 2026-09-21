/**
 * Contact form: client-side validation for immediate feedback, Turnstile when
 * a site key is configured, and a graceful fallback to email/WhatsApp if the
 * endpoint is unreachable. The server validates everything again — this layer
 * is a courtesy, not a control.
 */
declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

const SITE_KEY = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY as string | undefined;

let bound: HTMLFormElement | null = null;

export function initContactForm(): void {
  const form = document.querySelector<HTMLFormElement>('[data-contact-form]');
  if (!form || form === bound) return;
  bound = form;

  const lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
  const status = form.querySelector<HTMLElement>('[data-status]')!;
  const fallback = form.querySelector<HTMLElement>('[data-fallback]')!;
  const submit = form.querySelector<HTMLButtonElement>('[data-submit]')!;
  const messages = readMessages(form);

  mountTurnstile(form);

  const showFieldError = (name: string, text: string | null) => {
    const field = form.elements.namedItem(name) as HTMLInputElement | null;
    const box = form.querySelector<HTMLElement>(`[data-err-for="${name}"]`);
    if (!field || !box) return;
    field.setAttribute('aria-invalid', text ? 'true' : 'false');
    box.textContent = text ?? '';
    box.hidden = !text;
  };

  const validate = (): boolean => {
    let ok = true;
    const name = (form.elements.namedItem('name') as HTMLInputElement).value.trim();
    const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim();
    const message = (form.elements.namedItem('message') as HTMLTextAreaElement).value.trim();

    showFieldError('name', name.length >= 2 ? null : messages.name);
    if (name.length < 2) ok = false;

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 180;
    showFieldError('email', emailOk ? null : messages.email);
    if (!emailOk) ok = false;

    showFieldError('message', message.length >= 10 ? null : messages.message);
    if (message.length < 10) ok = false;

    if (!ok) {
      form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }
    return ok;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent = '';
    status.removeAttribute('data-tone');
    if (!validate()) return;

    submit.setAttribute('aria-disabled', 'true');
    submit.textContent = submit.dataset.busy!;

    const payload = Object.fromEntries(new FormData(form).entries());
    payload.locale = lang;

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: keyof typeof messages;
        field?: string;
      };

      if (response.ok && data.ok) {
        form.reset();
        window.turnstile?.reset();
        status.dataset.tone = 'ok';
        status.textContent = messages.success;
        fallback.hidden = true;
        return;
      }

      if (data.field) showFieldError(data.field, messages[data.field as keyof typeof messages] ?? null);
      status.dataset.tone = 'error';
      status.textContent = messages[(data.error ?? 'server') as keyof typeof messages] ?? messages.server;
      fallback.hidden = false;
    } catch {
      status.dataset.tone = 'error';
      status.textContent = messages.network;
      fallback.hidden = false;
    } finally {
      submit.removeAttribute('aria-disabled');
      submit.textContent = submit.dataset.idle!;
    }
  });

  // Clear an error as soon as the visitor starts fixing the field.
  form.addEventListener('input', (event) => {
    const target = event.target as HTMLElement;
    if (target.getAttribute('aria-invalid') === 'true') {
      showFieldError((target as HTMLInputElement).name, null);
    }
  });
}

/** Error copy is rendered into data attributes by the page, never hard-coded here. */
function readMessages(form: HTMLFormElement) {
  const data = JSON.parse(form.dataset.messages || '{}') as Record<string, string>;
  return {
    name: data.name ?? '',
    email: data.email ?? '',
    message: data.message ?? '',
    tooLong: data.tooLong ?? '',
    captcha: data.captcha ?? '',
    rate: data.rate ?? '',
    server: data.server ?? '',
    network: data.network ?? '',
    success: data.success ?? '',
  };
}

function mountTurnstile(form: HTMLFormElement) {
  const holder = form.querySelector<HTMLElement>('[data-turnstile]');
  if (!holder || !SITE_KEY) return; // no key configured yet: the server allows it through in dev

  const render = () => {
    if (!window.turnstile || holder.dataset.rendered) return;
    holder.dataset.rendered = 'true';
    window.turnstile.render(holder, {
      sitekey: SITE_KEY,
      theme: 'light',
      language: document.documentElement.lang === 'ar' ? 'ar' : 'en',
    });
  };

  if (window.turnstile) {
    render();
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad';
  script.async = true;
  script.defer = true;
  window.onTurnstileLoad = render;
  document.head.appendChild(script);
}

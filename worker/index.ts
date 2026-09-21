/**
 * Cloudflare Worker entry point — the alternative to the Pages deployment.
 *
 * The site currently deploys through Cloudflare Pages (see functions/), and
 * this file exists so it can also run as a Worker with static assets. Both
 * share the same logic in shared/, so neither can drift from the other.
 *
 * Static pages are served straight from the assets binding; this script owns
 * only "/" and "/api/*" (see assets.run_worker_first in wrangler.workers.jsonc).
 */
import type { Env } from '../shared/env';
import { handleContact } from '../shared/contact';
import { redirectToLocale } from '../shared/lang';
import { withSecurity } from '../shared/security';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/contact') {
      return withSecurity(await handleContact(request, env));
    }

    if (url.pathname === '/' || url.pathname === '') {
      return withSecurity(redirectToLocale(request));
    }

    // Anything else reaching the Worker falls through to the static assets.
    return env.ASSETS!.fetch(request);
  },
};

export { preferredLocale } from '../shared/lang';

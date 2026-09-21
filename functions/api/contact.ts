/**
 * Cloudflare Pages Function for POST /api/contact.
 *
 * All the logic lives in shared/contact.ts so the Worker entry point in
 * worker/index.ts behaves identically.
 *
 * Rate limiting: Pages has no rate-limiting binding, so env.CONTACT_RATE_LIMIT
 * is undefined here and the limit is enforced by a WAF rate-limiting rule on
 * the zone instead. See README, "Rate limiting on Pages".
 */
import type { Env } from '../../shared/env';
import { handleContact } from '../../shared/contact';
import { withSecurity } from '../../shared/security';

export const onRequest: PagesFunction<Env> = async ({ request, env }) =>
  withSecurity(await handleContact(request, env));

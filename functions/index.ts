/**
 * Cloudflare Pages Function for "/" — language negotiation.
 *
 * File-based routing: functions/index.ts serves the bare root, and Functions
 * take precedence over static assets, so dist/index.html is only ever reached
 * if this file is removed.
 *
 * Note there is deliberately no functions/_middleware.ts: a root middleware
 * runs in front of every static asset too, which would put a Function
 * invocation on the critical path of every page, font and image.
 */
import type { Env } from '../shared/env';
import { redirectToLocale } from '../shared/lang';
import { withSecurity } from '../shared/security';

export const onRequestGet: PagesFunction<Env> = ({ request }) =>
  withSecurity(redirectToLocale(request));

export const onRequestHead: PagesFunction<Env> = ({ request }) =>
  withSecurity(redirectToLocale(request));

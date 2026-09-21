/**
 * Security headers for responses this code generates itself.
 *
 * The `_headers` file covers static assets only — on both Pages and Workers it
 * is explicitly not applied to responses from Functions or Worker code — so
 * anything we build here carries its own headers.
 */
export const SECURITY_HEADERS: Record<string, string> = {
  'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy':
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
};

/** For JSON and redirect responses, which render nothing. */
export const NO_CONTENT_CSP =
  "default-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

/** For the small HTML pages this code renders (the no-JavaScript form reply). */
export const INLINE_PAGE_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

export function withSecurity(response: Response, csp = NO_CONTENT_CSP): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) headers.set(key, value);
  if (!headers.has('content-security-policy')) headers.set('content-security-policy', csp);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

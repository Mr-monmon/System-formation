/**
 * Runtime bindings, shared by both deployment targets.
 *
 * The site runs on Cloudflare Pages (functions/) and can also run as a Worker
 * with static assets (worker/). Everything in shared/ is written against this
 * interface so the two entry points stay thin and the logic has one home.
 */
export interface Env {
  /** Pages and Workers both expose the static assets this way. */
  ASSETS?: Fetcher;

  /** Turnstile server-side key. Without it the token check is skipped. */
  TURNSTILE_SECRET_KEY?: string;

  /** Resend API key. Without it nothing is sent and the caller is told so. */
  RESEND_API_KEY?: string;

  /** Where enquiries go, and the verified From address they are sent as. */
  CONTACT_TO?: string;
  CONTACT_FROM?: string;

  /** Test seam only: points delivery at a mock. Never set in production. */
  RESEND_API_BASE?: string;

  /**
   * Workers only. Pages has no rate-limiting binding, so on Pages the limit is
   * enforced by a WAF rate-limiting rule instead (see README).
   */
  CONTACT_RATE_LIMIT?: RateLimit;
}

export interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

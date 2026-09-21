# Handover — what is still needed

Everything below is either a value only you have, a decision only you can make,
or a check that can only run against the live domain. Nothing here blocks the
site from running locally.

## 1. Placeholders in the copy

Each one appears in **both** `src/i18n/ar.json` and `src/i18n/en.json`. Search
for the bracketed text and replace it in both files.

| Placeholder (EN / AR) | Where it shows | Needed for |
|---|---|---|
| `[CR NUMBER]` / `[رقم السجل التجاري]` | Footer, Privacy Policy §"Who we are" | Commercial registration number |
| `[VAT NUMBER]` / `[الرقم الضريبي]` | Footer | VAT registration number |
| `[CITY / ADDRESS]` / `[المدينة / العنوان]` | Contact page, footer, Privacy Policy | Registered address |
| `[RETENTION PERIOD]` / `[مدة الاحتفاظ]` | Privacy Policy §"How long we keep it" | e.g. "24 months" — a lawyer should set this |
| `[ANALYST COST]` / `[تكلفة المحلّل]` | Savings estimator, shown to the visitor | See §2 |

## 2. The savings estimator's one assumption

`src/scripts/estimator.ts` assumes **SAR 25,000/month fully loaded per
analyst**. The figure is displayed to the visitor rather than hidden in the
maths, and the whole model is documented at the top of that file.

The estimator is deliberately conservative: the result is a *range* whose lower
bound is 65% of the modelled saving, and the whole thing is hard-capped at 60%
of the baseline, so it can never promise more than the claim the company makes
in writing. It is labelled "Indicative" and carries "book an assessment for a
real model" under the result.

**Confirm the SAR 25,000 figure**, or tell me what to use. If you would rather
not publish a cost-per-analyst assumption at all, the alternative is to drop
the analyst input and ask only for current monthly spend — say the word and I
will switch it.

## 3. Email delivery — decision needed

The contact endpoint is written, validated, rate-limited and Turnstile-ready.
**No email is sent until a delivery route is configured**; until then it fails
loudly, logs the submission, and shows the visitor the email address and
WhatsApp link rather than silently dropping the message.

| | Resend (implemented) | Cloudflare `send_email` |
|---|---|---|
| Status | GA, stable | Beta at the time of writing |
| Plan | Free tier, then paid | Workers Paid |
| Setup | API key + verified domain | Binding + onboarded sending domain |
| SPF/DKIM/DMARC | You add them | Handled for domains on Cloudflare DNS |
| Failure mode | An HTTP call that can fail | In-process binding |

I implemented Resend because it is GA and Cloudflare's own tutorial recommends
it. Switching means replacing the body of `deliver()` in `worker/index.ts`;
everything around it is delivery-agnostic.

## 4. Secrets to set before launch

```bash
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put RESEND_API_KEY        # or whichever provider you pick
```

And the **public** Turnstile site key in `.env`:

```
PUBLIC_TURNSTILE_SITE_KEY=...
```

Without the secret key the Turnstile check is skipped, so set it before launch.

## 5. Cloudflare account and deployment

This work was built in a sandboxed environment with **no Cloudflare
credentials**, so nothing has been deployed and no DNS has been touched.

1. Confirm which Cloudflare account owns `systemformation.com`.
2. `npx wrangler login`, then `npm run cf:deploy`.
3. **Before attaching custom domains**, check the zone's existing DNS records —
   attaching a custom domain rewrites them. `routes` is deliberately commented
   out in `wrangler.jsonc` for this reason. Tell me what is on the zone and I
   will tell you what would conflict.
4. Add a redirect rule for `www` → apex, and confirm "Always Use HTTPS" is on.

## 6. Checks that need the live domain

- **securityheaders.com** and **Mozilla Observatory**: the header set is built
  for A+ (CSP with per-script hashes and no `unsafe-inline`, HSTS with preload,
  `frame-ancestors 'none'`, Referrer-Policy, Permissions-Policy, COOP/CORP),
  but the scan can only run against the live site. Run both after the first
  deploy and send me the results.
- **HSTS preload**: `max-age=63072000; includeSubDomains; preload` is set. Only
  submit to hstspreload.org once you are certain every subdomain is HTTPS.

## 7. Legal review

`/privacy/` and `/terms/` are drafts and say so on the page, in both languages.
The privacy policy is written around PDPL principles (what the form collects,
why, retention, transfer conditions, data subject rights, SDAIA as the
complaint route). **A qualified Saudi lawyer must review both before launch.**

## 8. Regulatory framework versions

The compliance page cites ECC-2:2024, CCC-2:2024, DCC-1:2022, CSCC-1:2019,
OTCC-1:2022, SAMA CSF and BCM, PDPL and its Implementing Regulations, and CST's
CCRF and CRF (RT08). These were checked against a current reference set, but
regulators reissue documents — **verify each version on the regulator's own
site before launch**, since a stale version number on a compliance page is the
kind of detail your clients will notice.

The page states plainly that System Formation is not certified, accredited or
endorsed by any authority named on it.

## 9. Optional / your call

- **Analytics**: none installed, by design. If you want it, Cloudflare Web
  Analytics is cookieless and needs one script tag plus a CSP entry. Ask and I
  will add it.
- **Social profiles**: `sameAs` in the Organization JSON-LD is empty. Send me
  LinkedIn/X URLs and I will add them.
- **A vector original of the logo**: the SVG mark was rebuilt by measuring the
  supplied raster and regularising the geometry. If your designer has the
  original vector, swapping it in is a two-path replacement in
  `src/components/ui/Mark.astro` followed by `npm run og`.

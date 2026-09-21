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

## 3. Email delivery — Resend (decided)

Resend is implemented and the outbound payload has been verified end to end
against a local mock: correct endpoint, bearer auth, and a body carrying
`from`, `to`, `reply_to`, `subject` and `text`, with Arabic field labels when
the enquiry came from the Arabic form. Replying to the notification replies to
the enquirer.

**What is left is account setup**, in [DEPLOY.md](./DEPLOY.md) §3: verify
`systemformation.com` in Resend, add its DNS records to the Cloudflare zone,
and set `RESEND_API_KEY`.

> ⚠️ **One thing to watch.** If the domain already sends mail (Google
> Workspace, Microsoft 365, anything), a domain may have only **one SPF
> record**. Adding Resend's as a second `v=spf1` TXT record breaks
> authentication for all your mail. Send me the current SPF record and I will
> give you the merged value.

Until the key is set the form does not fail silently: it returns an error, logs
the submission, and shows the visitor the email address and WhatsApp link.

## 4. Secrets to set

All of them go in **Pages → Settings → Environment variables**, for Production
and Preview both. The build-time vs runtime distinction matters — see
[DEPLOY.md](./DEPLOY.md) §2.

| Variable | Kind | Notes |
|---|---|---|
| `PUBLIC_TURNSTILE_SITE_KEY` | build-time, plaintext | Baked into the HTML; needs a redeploy to take effect |
| `TURNSTILE_SECRET_KEY` | runtime, encrypted | Without it the bot check is skipped |
| `RESEND_API_KEY` | runtime, encrypted | Without it no email is sent |
| `CONTACT_TO` / `CONTACT_FROM` | runtime, plaintext | `CONTACT_FROM` must be on the Resend-verified domain |

## 5. Deployment — already most of the way there

`systemformation.com` is attached to the Pages project and Active with SSL, so
there is no DNS work for the site itself.

What remains: confirm the Pages **build settings** (build command `npm run
build`, output directory `dist` — the project was created when this repository
was still empty, so it may have been set up with neither), set the variables
above, and merge this branch into `main`. Full runbook in
[DEPLOY.md](./DEPLOY.md).

Rate limiting needs a **WAF rate-limiting rule** on the zone, because Pages has
no rate-limiting binding — DEPLOY.md §5 has the exact values, including what
the Free plan allows.

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
CCRF and CRF (RT08).

These were checked against a current reference set, and ECC-2:2024 was
confirmed as the live version (there is no ECC-3). The regulators' own sites —
nca.gov.sa, sama.gov.sa, sdaia.gov.sa, cst.gov.sa — are unreachable from the
environment this was built in, so the confirmation is second-hand.
**Have someone open each regulator's page and tick the version numbers off
before launch.** A stale version on a compliance page is exactly the detail
your clients will notice.

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

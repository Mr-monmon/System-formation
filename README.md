# System Formation — systemformation.com

Bilingual (Arabic RTL / English LTR) marketing site for **System Formation Co. Ltd**
(شركة تشكيل النظم المحدودة), built with Astro and deployed to Cloudflare Workers
with static assets.

- **Arabic is the default language.** `/` negotiates and redirects to `/ar/` or `/en/`.
- **No third-party requests** in the page: fonts are self-hosted, there are no
  trackers, and the only external origin the CSP allows is Cloudflare Turnstile
  on the contact form.
- **First-load JavaScript is ~8 KB gzipped.** GSAP, ScrollTrigger and Lenis are
  dynamically imported after paint, and are never loaded at all under
  `prefers-reduced-motion`.

---

## Run it locally

```bash
npm install
npm run dev          # http://localhost:4321 — Astro dev server, no Worker
```

The Astro dev server does not run `worker/index.ts`, so `/` will not redirect
and `/api/contact` will 404. To exercise the whole thing, including the Worker:

```bash
npm run build
npm run cf:dev       # wrangler dev — serves dist/ plus the Worker
```

Other scripts:

| Command | What it does |
|---|---|
| `npm run build` | Astro build, then generates `dist/_headers` with fresh CSP hashes |
| `npm run og` | Regenerates favicons, OG cards and the raster lockup from the SVG mark |
| `npm run serve` | Serves `dist/` on :4322 **with gzip**, the way Cloudflare does |
| `npm run shots` | Screenshots every page × both languages × 4 widths into `.review/` |
| `npm run lh` | Lighthouse for `/ar/` and `/en/`, mobile and desktop |
| `npm run check` | Astro type check |
| `npm run cf:deploy` | Build and deploy to Cloudflare |

Measure performance against `npm run serve`, not `astro preview` or a plain
static server: without compression the HTML is ~145 KB instead of ~26 KB and
every paint metric is meaningless.

### Measured results

Lighthouse, against the compressing server, at the last commit:

| Page | Mobile | Desktop |
|---|---|---|
| `/ar/` | 97 | 100 |
| `/en/` | 99 | 100 |
| `/ar/contact/` | 100 | 100 |
| `/en/services/` | 100 | 100 |

Accessibility, best practices and SEO are 100 on every page. First-load JS is
8.4 KB gzipped; GSAP, ScrollTrigger and Lenis load after paint, and not at all
under `prefers-reduced-motion`.

---

## Editing the copy

**All text lives in two files.** No string is hard-coded in a component:

```
src/i18n/ar.json    Arabic
src/i18n/en.json    English
```

The two files must keep exactly the same key structure — the build reads
English for types and Arabic for the default locale. To check after an edit:

```bash
node -e "const a=require('./src/i18n/ar.json'),e=require('./src/i18n/en.json');
const k=o=>JSON.stringify(Object.keys(o).sort());console.log(k(a)===k(e)?'keys match':'KEYS DIFFER')"
```

Adding a service, a value or a compliance framework means adding an object to
the right array in **both** files — the pages render whatever is there.

Page routes share one slug across languages (`/ar/services/`, `/en/services/`)
so the language switch always lands on the equivalent page. Slugs are defined
once in `src/i18n/index.ts` under `routes`.

---

## Brand

| What | Where |
|---|---|
| Colour, type, spacing and motion tokens | `src/styles/tokens.css` |
| Base styles, fonts, focus, reduced motion | `src/styles/global.css` |
| The S-mark as two animatable paths | `src/components/ui/Mark.astro` |
| Mark geometry (source of truth) | `scripts/build-mark.py` → `scripts/mark-paths.json` |
| Supplied raster original | `brand/source/` |
| Generated SVG/PNG brand assets | `public/brand/`, `public/og/`, `public/favicon*` |

Every colour token was sampled from the supplied logo rather than guessed, and
each one carries its WCAG contrast ratio as a comment. The Arabic type scale is
defined separately in `tokens.css` (larger size, ~1.8 line-height, never
letter-spaced) — change it there, not with per-component overrides.

The S-mark was rebuilt from the raster by measuring the artwork scanline by
scanline and then regularising it: every arm now runs on the same ±25° slope
with a consistent band width. If you get a vector original from the designer,
replace the two path strings in `Mark.astro` and rerun `npm run og`.

---

## Deploying

```bash
npx wrangler login        # once, on a machine with a browser
npm run cf:deploy
```

`wrangler.jsonc` configures:

- `assets.directory: ./dist` with `not_found_handling: "404-page"`
- `assets.run_worker_first: ["/", "/api/*"]` — everything else is served
  straight from the edge and never invokes (or bills for) the Worker
- a `ratelimits` binding, 5 contact submissions per minute per IP

### Custom domains

**Not attached yet, on purpose.** `routes` is commented out in
`wrangler.jsonc` because attaching a custom domain rewrites DNS on the zone.
Before uncommenting it, check what is already on the zone:

```bash
npx wrangler dns records list systemformation.com   # or check the dashboard
```

Then uncomment the `routes` block and deploy. Cloudflare creates the proxied
records for `systemformation.com` and `www.systemformation.com`. Add a
redirect rule (Rules → Redirect Rules) to send `www` → apex with a 301;
HTTP → HTTPS is handled by the zone's "Always Use HTTPS" setting.

### Secrets

Never commit these. Set them with `wrangler secret put`:

| Secret | Needed for | If missing |
|---|---|---|
| `TURNSTILE_SECRET_KEY` | Verifying the contact form's Turnstile token | The check is skipped — set it before launch |
| `RESEND_API_KEY` | Sending the contact email | The endpoint returns a 502 and the form shows the email address and WhatsApp link instead of silently dropping the message |

The **public** Turnstile site key goes in `.env` as
`PUBLIC_TURNSTILE_SITE_KEY=...` (it is embedded in the page, so it is not a
secret). Without it the widget simply does not mount.

For local testing, put the same values in `.dev.vars` (git-ignored).

### Email delivery — the choice that is still open

The Worker currently implements **Resend** (`worker/index.ts` → `deliver()`).
The alternative is Cloudflare's own `send_email` binding:

| | Resend (implemented) | Cloudflare `send_email` |
|---|---|---|
| Status | GA, stable | Beta at the time of writing |
| Plan | Free tier, then paid | Workers Paid |
| Setup | API key + verified domain | Binding + onboarded sending domain |
| Auth records | You add SPF/DKIM | Handled for domains on Cloudflare DNS |
| Failure mode | HTTP call can fail | In-process binding |

To switch, add a `send_email` binding to `wrangler.jsonc` and replace the body
of `deliver()`. The rest of the endpoint — validation, rate limiting, Turnstile,
the honeypot and the fallback — is delivery-agnostic.

---

## Security

- `dist/_headers` is generated at build time by `scripts/build-headers.mjs`,
  which hashes every inline script so the CSP needs no `'unsafe-inline'` for
  `script-src`.
- **`_headers` only covers static asset responses.** Responses the Worker
  generates itself (the `/` redirect and `/api/contact`) set their own headers
  in `worker/index.ts` — if you change one, change both.
- `/.well-known/security.txt` points at info@systemformation.com. Its `Expires`
  date needs bumping annually.
- The contact endpoint enforces: same-origin check, per-IP rate limit, a
  honeypot field, server-side length and format validation, and Turnstile.

---

## Accessibility and motion

- Semantic landmarks, a skip link, visible focus rings, keyboard-operable nav,
  tabs and slide dots, `aria-live` form status, and alt text in both languages.
- `prefers-reduced-motion` is honoured completely: smooth scrolling, parallax
  and entrance animations are all skipped and final states render immediately.
  The motion bundle is not even downloaded.
- Animations only ever touch `transform` and `opacity`, so nothing reflows.
- Direction-aware motion: anything entering "from the start" enters from the
  right in Arabic and the left in English (`flow()` in `src/scripts/motion.ts`).

---

## Project layout

```
brand/source/        supplied logo files (the colour source of truth)
public/              static assets served as-is: fonts, icons, OG cards, robots, security.txt
scripts/             mark geometry, header generation, OG rendering, screenshot review
src/components/      ui/ primitives, sections/ set pieces, pages/ page compositions
src/i18n/            ar.json, en.json and the route helpers
src/layouts/         Base.astro — head, SEO, JSON-LD, transitions
src/pages/{ar,en}/   thin route files, one per page per language
src/scripts/         motion, estimator and contact-form client code
src/styles/          tokens.css, global.css
worker/              the Cloudflare Worker
```

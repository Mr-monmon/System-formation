# System Formation — systemformation.com

Bilingual (Arabic RTL / English LTR) marketing site for **System Formation Co. Ltd**
(شركة تشكيل النظم المحدودة), built with Astro and deployed to **Cloudflare Pages**.

**Deploying or configuring it? See [DEPLOY.md](./DEPLOY.md).**

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

The Astro dev server does not run the Functions, so `/` will not redirect and
`/api/contact` will 404. To exercise the whole thing:

```bash
npm run pages:dev    # builds, then serves dist/ + functions/ exactly as Pages does
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
| `npm run pages:dev` | Serve the built site plus Functions, as Pages runs them |
| `npm run cf:deploy` | Deploy as a Worker instead of Pages (the alternative path) |

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

Cloudflare Pages builds from git: push to `main` and the production site
updates. Every other branch gets a preview URL.

**[DEPLOY.md](./DEPLOY.md) has the full runbook** — build settings, the
build-time vs runtime environment variables, Resend and Turnstile setup, the
rate-limiting rule, and what to check before merging.

Two entry points, one set of logic:

```
functions/index.ts        Pages Function for "/"          -> shared/lang.ts
functions/api/contact.ts  Pages Function for the form     -> shared/contact.ts
worker/index.ts           the Workers alternative         -> the same modules
```

`shared/` holds everything real, so the two targets cannot drift apart. There
is deliberately **no `functions/_middleware.ts`**: a root middleware on Pages
runs in front of every static asset too, which would put a Function invocation
on the critical path of every page, font and image.

## Security

- `dist/_headers` is generated at build time by `scripts/build-headers.mjs`,
  which hashes every inline script so the CSP needs no `'unsafe-inline'` for
  `script-src`.
- **`_headers` only covers static asset responses.** On both Pages and Workers
  it is explicitly not applied to responses generated by Functions or Worker
  code, so those set their own headers in `shared/security.ts`.
- `/.well-known/security.txt` points at info@systemformation.com. Its `Expires`
  date needs bumping annually.
- The contact endpoint enforces: a same-origin check, a honeypot field,
  server-side length and format validation, and Turnstile. Rate limiting is a
  binding on Workers and a WAF rule on Pages — see DEPLOY.md §5.

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
functions/           Cloudflare Pages Functions: "/" and /api/contact
shared/              runtime logic both deployment targets import
public/              static assets served as-is: fonts, icons, OG cards, robots, security.txt
scripts/             mark geometry, header generation, OG rendering, screenshot review
src/components/      ui/ primitives, sections/ set pieces, pages/ page compositions
src/i18n/            ar.json, en.json and the route helpers
src/layouts/         Base.astro — head, SEO, JSON-LD, transitions
src/pages/{ar,en}/   thin route files, one per page per language
src/scripts/         motion, estimator and contact-form client code
src/styles/          tokens.css, global.css
worker/              the Workers entry point (the alternative to Pages)
```

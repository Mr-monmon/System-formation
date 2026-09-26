# Deploying to tashkeeltech.com

The site is on **Cloudflare Pages** (project `system-formation`) and currently
serves **systemformation.com**. It is moving to **tashkeeltech.com** under the
tashkeel tech brand. §0 is that move; §1–§5 are the standing configuration.

The build settings (§1) are already correct — they were fixed after the first
production deploy published the repository source instead of `dist/`.

---

## 0. Moving to tashkeeltech.com

Order matters: bring the new domain up first, check it, and only then redirect
the old one. Redirecting first would send every visitor to a domain that is not
serving yet.

### 0.1 Put tashkeeltech.com on Cloudflare

An **apex** custom domain on Pages must be a zone on the **same Cloudflare
account** as the Pages project, with its nameservers pointed at Cloudflare.
If tashkeeltech.com is registered elsewhere: **Add a domain** in the dashboard,
then change the nameservers at the registrar to the two Cloudflare gives you.
Wait for the zone to show **Active**.

### 0.2 Attach it to the Pages project

**Workers & Pages → `system-formation` → Custom domains → Set up a custom
domain**: add `tashkeeltech.com`, then `www.tashkeeltech.com`. Cloudflare
creates the DNS records itself. Wait for both to show **Active** and SSL
enabled.

Leave `systemformation.com` attached for now.

### 0.3 Check the new domain before touching the old one

- `https://tashkeeltech.com/` redirects to `/ar/` (or `/en/` if your browser
  prefers English)
- `https://tashkeeltech.com/ar/` shows the tashkeel tech logo and navy design
- view the page source: `<link rel="canonical">` points at
  `https://tashkeeltech.com/...` — the site already declares the new domain as
  canonical, so search engines consolidate onto it even before §0.4

### 0.4 Redirect everything from systemformation.com

On the **systemformation.com** zone: **Rules → Redirect Rules → Create rule**
(a Single Redirect).

| Field | Value |
|---|---|
| Rule name | `Move to tashkeeltech.com` |
| When incoming requests match | **Wildcard pattern** |
| Request URL | `http*://*systemformation.com/*` |
| Target URL | `https://tashkeeltech.com/${3}` |
| Status code | **301** |
| Preserve query string | **Enabled** |

Each `*` matches zero or more characters, so this one rule covers `http` and
`https`, the apex and `www`, and every path: `${3}` is the path, the third
wildcard. `https://www.systemformation.com/en/services/?x=1` lands on
`https://tashkeeltech.com/en/services/?x=1`.

Redirect Rules run at the edge before Pages, so they take effect while
systemformation.com is still attached. **Keep the old zone and domain
registered** for as long as the old address is on business cards, email
signatures or search results — letting it lapse breaks every one of those links.

The `/api/contact` endpoint moves with the site; the form posts to its own
origin, so nothing else changes.

### 0.5 Point the supporting services at the new domain

- **Turnstile** — add `tashkeeltech.com` to the widget's hostnames. The
  widget refuses to run on a hostname it does not list.
- **Resend** — verify **tashkeeltech.com** as a sending domain (§3). The form
  now sends *from* `website@tashkeeltech.com` by default.
- **Where enquiries arrive** — still **info@systemformation.com**, the mailbox
  that exists today. When a mailbox exists on tashkeeltech.com, change
  `CONTACT_TO` (§2) and the address in `src/i18n/ar.json` and `en.json`.
- **Google Search Console** — add `tashkeeltech.com` as a property, submit
  `https://tashkeeltech.com/sitemap-index.xml`, then run **Change of Address**
  from the systemformation.com property. That tool needs the 301s from §0.4 to
  be live first.

## 1. Check the build settings

**Workers & Pages → `system-formation` → Settings → Build**

| Setting | Value |
|---|---|
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` (leave empty) |

Node version is pinned by `.nvmrc` (22) in the repo, so you do not need to set
`NODE_VERSION` — but if a build ever fails on the Node version, add
`NODE_VERSION = 22` as a build environment variable and it wins.

> **Worth verifying before anything else.** The Pages project was created when
> this repository was still empty, so it may have been set up with no build
> command and an output directory of `/`. If so it is publishing the repository
> source instead of the built site, and the preview URL will look broken. The
> table above is what it needs.

---

## 2. Environment variables

**Settings → Environment variables.** Set these for **Production** and
**Preview** both, or previews will behave differently from the live site.

Two kinds, and the difference matters:

### Build-time — plaintext

| Variable | Value |
|---|---|
| `PUBLIC_TURNSTILE_SITE_KEY` | Turnstile **site** key (see §4) |

Astro bakes this into the HTML at build time. It is public by design. **A change
only takes effect after a rebuild** — set it, then redeploy.

### Runtime — encrypted (select "Encrypt")

| Variable | Value |
|---|---|
| `TURNSTILE_SECRET_KEY` | Turnstile **secret** key (see §4) |
| `RESEND_API_KEY` | Resend API key (see §3) |

### Runtime — plaintext

| Variable | Value |
|---|---|
| `CONTACT_TO` | `info@systemformation.com` (until a tashkeeltech.com mailbox exists) |
| `CONTACT_FROM` | `tashkeel tech <website@tashkeeltech.com>` |

If `RESEND_API_KEY` is missing the form does not fail silently: it returns an
error, logs the submission, and shows the visitor the email address and
WhatsApp link instead. If `TURNSTILE_SECRET_KEY` is missing the bot check is
skipped, so set it before launch.

---

## 3. Resend

1. Create an account at resend.com and add the domain **tashkeeltech.com** — the
   domain the site sends from.
2. Resend gives you DNS records — an SPF `TXT`, a DKIM `TXT`, and usually an
   `MX` for bounce handling. Add them in **Cloudflare → DNS** for the zone.
   Add them on the **tashkeeltech.com** zone. They are `TXT`/`MX` records, so the
   orange-cloud proxy setting does not apply to them.

   > ⚠️ **If the domain already sends email** (Google Workspace, Microsoft 365,
   > anything), a domain may only have **one SPF record**. Do not add a second
   > `v=spf1` TXT record — merge Resend's include into the existing one, e.g.
   > `v=spf1 include:_spf.google.com include:amazonses.com ~all`. Two SPF
   > records break authentication for *all* your mail, not just this form.
   > Send me the current SPF record and I will give you the merged value.

3. Wait for Resend to report the domain as verified.
4. Create an API key with **Sending access** only, and put it in
   `RESEND_API_KEY`.
5. `CONTACT_FROM` must be an address on the verified domain — Resend rejects
   anything else.

The endpoint sets `reply_to` to the enquirer's address, so replying to the
notification replies to them directly.

---

## 4. Turnstile

1. **Cloudflare dashboard → Turnstile → Add widget.**
2. Domain: `tashkeeltech.com`. Add `system-formation.pages.dev` too if you
   want previews protected.
3. Widget mode: **Managed**.
4. Copy the **site key** → `PUBLIC_TURNSTILE_SITE_KEY` (build-time variable).
5. Copy the **secret key** → `TURNSTILE_SECRET_KEY` (encrypted runtime).
6. **Redeploy**, so the site key is compiled into the pages.

The widget mounts itself only when a site key is present, so the form works
either way — it is just unprotected until you set one.

---

## 5. Rate limiting

Cloudflare Pages has no rate-limiting binding (Workers does; Pages does not),
so the limit is enforced at the zone instead.

**Security → Security rules → Create rule → Rate limiting rules**

| Field | Value |
|---|---|
| Rule name | `Contact form` |
| Field | **URI Path** — equals — `/api/contact` |
| Characteristics | **IP** |
| Requests | `5` |
| Period | `10 s` on Free, `1 min` on Pro and above |
| Action | Block |
| Duration | `10 s` on Free, `1 h` on Pro and above |

On the **Free plan** rate limiting is restricted to one rule, matching on Path
only, counting by IP, with a 10-second window — so it is a burst guard rather
than a sustained limit. That is still worth having, and the real protection
against automated abuse is Turnstile plus the honeypot field, both already in
the form.

---

## 6. Shipping changes

Every push to `main` builds and deploys to production automatically; every
other branch gets its own preview URL. Merge through a pull request, and open
its preview before merging:

- `/` redirects to `/ar/` (or `/en/` if your browser prefers English)
- `/ar/` and `/en/` render with the Cairo font and the tashkeel tech logo
- the language switch keeps you on the same page
- `/nonexistent` returns the branded 404

---

## 7. After the first production deploy

- **`www` → apex**: with `www.tashkeeltech.com` attached (§0.2), add a Redirect
  Rule on the tashkeeltech.com zone — wildcard `http*://www.tashkeeltech.com/*`
  to `https://tashkeeltech.com/${2}`, 301, preserve query string — so there is
  one canonical host.
- **Security scan**: run [securityheaders.com](https://securityheaders.com) and
  [Mozilla Observatory](https://developer.mozilla.org/en-US/observatory) against
  the live domain. The header set is built for A+ (CSP with a hash per inline
  script and no `unsafe-inline`, HSTS with `preload`, `frame-ancestors 'none'`,
  Referrer-Policy, Permissions-Policy, COOP/CORP). Send me what they report.
- **HSTS preload**: the header already carries `preload`. Submit
  tashkeeltech.com to hstspreload.org only once you are certain every subdomain
  is HTTPS — it is hard to undo. Do not submit systemformation.com; it only
  redirects now.
- **Search Console**: covered in §0.5 — new property, sitemap, Change of
  Address.

---

## Local development

```bash
npm install
npm run dev          # Astro only — no Functions, so "/" and /api/contact are inert
npm run pages:dev    # builds, then serves dist/ + functions/ exactly as Pages does
```

For `pages:dev`, copy `.dev.vars.example` to `.dev.vars` and fill it in.
`RESEND_API_BASE` in that file points delivery at a local mock so you can test
the form without sending real email.

## The Workers alternative

`worker/index.ts` and `wrangler.workers.jsonc` let the same site run as a
Worker with static assets instead of Pages. Both entry points import the same
logic from `shared/`, so they cannot drift apart. The Workers path gains a real
rate-limiting binding; switching would mean moving the custom domain, so it is
not worth doing unless you have another reason to.

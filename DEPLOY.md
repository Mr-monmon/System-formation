# Deploying to systemformation.com

The site is on **Cloudflare Pages** (project `system-formation`), and
`systemformation.com` is already attached as an Active custom domain with SSL.
So the domain work is done — what remains is making the build produce the right
output and giving the contact form its keys.

Nothing below touches DNS for the site itself. The only DNS records you add are
Resend's, for email.

---

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
| `CONTACT_TO` | `info@systemformation.com` |
| `CONTACT_FROM` | `System Formation <website@systemformation.com>` |

If `RESEND_API_KEY` is missing the form does not fail silently: it returns an
error, logs the submission, and shows the visitor the email address and
WhatsApp link instead. If `TURNSTILE_SECRET_KEY` is missing the bot check is
skipped, so set it before launch.

---

## 3. Resend

1. Create an account at resend.com and add the domain **systemformation.com**.
2. Resend gives you DNS records — an SPF `TXT`, a DKIM `TXT`, and usually an
   `MX` for bounce handling. Add them in **Cloudflare → DNS** for the zone.
   They are `TXT`/`MX` records, so the orange-cloud proxy setting does not
   apply to them.

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
2. Domain: `systemformation.com`. Add `system-formation.pages.dev` too if you
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

## 6. Going live

The branch `claude/ecstatic-hypatia-ybljot` currently builds as a **Preview**
deployment. To publish it to systemformation.com:

```bash
git checkout main
git merge claude/ecstatic-hypatia-ybljot
git push origin main
```

Pages builds `main` and promotes it to the production domain automatically.
Nothing needs to be attached or pointed — the custom domain is already Active.

> `main` originally held only two directly-uploaded logo files and shared no
> history with this branch, so that merge would have failed with *"refusing to
> merge unrelated histories"*. That is already handled: `main` has been merged
> into this branch, so the command above is now an ordinary fast-forward with
> no flags. The two root files were byte-identical to the copies in
> `brand/source/` and were removed in favour of those.

Prefer a pull request? Open one from `claude/ecstatic-hypatia-ybljot` into
`main` — it will merge cleanly for the same reason.

**Before merging**, open the preview URL and check:

- `/` redirects to `/ar/` (or `/en/` if your browser prefers English)
- `/ar/` and `/en/` render with fonts and the logo
- the language switch keeps you on the same page
- `/nonexistent` returns the branded 404

---

## 7. After the first production deploy

- **`www`**: if you want `www.systemformation.com` to work, add it as a second
  custom domain on the Pages project, then add a **Redirect Rule**
  (Rules → Redirect Rules) sending `www` → apex with a 301.
- **Security scan**: run [securityheaders.com](https://securityheaders.com) and
  [Mozilla Observatory](https://developer.mozilla.org/en-US/observatory) against
  the live domain. The header set is built for A+ (CSP with a hash per inline
  script and no `unsafe-inline`, HSTS with `preload`, `frame-ancestors 'none'`,
  Referrer-Policy, Permissions-Policy, COOP/CORP). Send me what they report.
- **HSTS preload**: the header already carries `preload`. Only submit the domain
  to hstspreload.org once you are certain every subdomain is HTTPS — it is hard
  to undo.
- **Submit the sitemap**: `https://systemformation.com/sitemap-index.xml` in
  Google Search Console.

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

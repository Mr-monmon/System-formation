# tashkeel tech — brand kit

Source of truth for the brand. If any earlier instruction (including the original
website prompt) gives different colours, fonts or logo details, THIS FILE WINS.

- Brand name: **tashkeel tech** (Arabic: **تشكيل**)
- Tagline: "CYBERSECURITY SOLUTIONS" / "تشكيل مستقبل أكثر أماناً" / "للحلول السيبرانية"
- Legal entity (footer, legal pages): System Formation Co. Ltd — شركة تشكيل النظم المحدودة
- Domain: systemformation.com

## Using this kit in a project
1. Inspect the project first and put these files wherever its framework serves static
   assets (e.g. `public/brand/`). Do not hard-code paths from this README — adapt.
2. Use the provided SVG files as-is (inline them or reference them). All text in the
   logos is already converted to outlines, so they render identically everywhere.
3. Never redraw, recolour, rotate, stretch, add gradients/shadows/glows to, or
   re-typeset the logo. If a size or colour variant is missing, ask.
4. Load `tokens.css` (or map its variables into the project's theme system).

## Files
| File | Use |
|---|---|
| `logo/svg/lockup-en-on-dark.svg` | Primary logo — header/footer on dark backgrounds |
| `logo/svg/lockup-en-on-light.svg` | Same, for light backgrounds (navy) |
| `logo/svg/lockup-en-white.svg` | Single-colour white (photos, busy backgrounds) |
| `logo/svg/lockup-en-full-on-dark.svg` / `-on-light` | With English + Arabic taglines (hero, about, print) |
| `logo/svg/lockup-ar-on-dark.svg` / `-on-light` | Arabic lockup — use on /ar pages where the brand is shown in Arabic |
| `logo/svg/mark-neon.svg` / `mark-navy.svg` / `mark-white.svg` | Symbol alone (loaders, section motifs, small spaces) |
| `logo/png/*` | 2× PNG versions of the above (email, docs, places SVG isn't accepted) |
| `icons/favicon.svg`, `favicon.png` (32), `favicon-48.png` | Browser favicons — simplified mark without the three dots |
| `icons/apple-touch-icon.png` (180) | iOS home screen |
| `icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png` | Web app manifest |
| `social/og-image.png` (1200×630) | Open Graph / Twitter card image |
| `tokens.css` | Colours and type tokens |

## Colours
| Token | Hex | Role |
|---|---|---|
| Neon | `#CCFF00` | Accent. The mark, primary buttons on dark, key highlights |
| Navy | `#081522` | Primary dark background; text colour on light backgrounds |
| Navy 2 | `#14263A` | Raised dark surfaces (cards, header on scroll) |
| Slate | `#33485E` | Secondary text on light |
| Gray | `#64748B` | Captions on light |
| Mist | `#DCE6F0` | Secondary text on dark |
| Light | `#F8FAFC` | Light section background |

Rules:
- The logo is flat neon only — no gradients.
- **Neon is never used for text or thin lines on white/light backgrounds** (contrast
  below 2:1). On light surfaces use the navy logo and navy/slate text. Neon may be a
  fill with navy text on top (e.g. a neon button with navy label).
- Dark (navy) is the default canvas for the brand; light sections are the exception.

## Typography
- **Cairo** for both Arabic and Latin (Google Fonts, OFL). Self-host it — e.g. via the
  `@fontsource-variable/cairo` package or downloaded woff2 files; don't call the
  Google Fonts CDN at runtime.
- Weights: 400 body, 600 labels, 700 headings, 900 display.
- Never add letter-spacing to Arabic text. Arabic body needs more line-height (~1.8).

## Logo rules
- Clear space around any logo: at least the width of the mark's central stem
  (≈ 12% of the mark's width) on every side.
- Minimum sizes: mark 24px tall; horizontal lockup 120px wide. Below 32px use the
  favicon version (no dots).
- Don't place the neon logo on mid-tone or busy images — use `lockup-en-white.svg`.

## HTML head snippet (adapt paths to the project)
```html
<link rel="icon" href="/brand/icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/brand/icons/favicon.png" sizes="32x32">
<link rel="apple-touch-icon" href="/brand/icons/apple-touch-icon.png">
<meta name="theme-color" content="#081522">
<meta property="og:image" content="https://systemformation.com/brand/social/og-image.png">
```

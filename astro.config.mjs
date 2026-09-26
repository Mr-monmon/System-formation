// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/**
 * Static build. The Worker in worker/index.ts serves dist/ as static assets and
 * owns only "/" (language negotiation) and "/api/*". See wrangler.jsonc.
 */
export default defineConfig({
  site: 'https://tashkeeltech.com',
  output: 'static',
  i18n: {
    locales: ['ar', 'en'],
    defaultLocale: 'ar',
    routing: { prefixDefaultLocale: true },
  },
  integrations: [
    sitemap({
      i18n: { defaultLocale: 'ar', locales: { ar: 'ar-SA', en: 'en' } },
      // Exclude the 404s and the bare "/" fallback: the root is a noindex
      // redirect that the Worker owns, not a page to be indexed.
      filter: (page) =>
        !page.includes('/404') && new URL(page).pathname !== '/',
    }),
  ],
  // One stylesheet for the whole site, inlined into the document: on a slow
  // connection the render-blocking round trip costs more than the ~6 KB the
  // inline copy adds. scripts/build-headers.mjs hashes it for the CSP.
  build: { assets: '_assets', inlineStylesheets: 'always' },
  vite: { build: { cssCodeSplit: false } },
  devToolbar: { enabled: false },
});

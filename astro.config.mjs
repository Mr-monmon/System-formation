// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/**
 * Static build. The Worker in worker/index.ts serves dist/ as static assets and
 * owns only "/" (language negotiation) and "/api/*". See wrangler.jsonc.
 */
export default defineConfig({
  site: 'https://systemformation.com',
  output: 'static',
  i18n: {
    locales: ['ar', 'en'],
    defaultLocale: 'ar',
    routing: { prefixDefaultLocale: true },
  },
  integrations: [
    sitemap({
      i18n: { defaultLocale: 'ar', locales: { ar: 'ar-SA', en: 'en' } },
      filter: (page) => !page.includes('/404'),
    }),
  ],
  build: { assets: '_assets', inlineStylesheets: 'never' },
  devToolbar: { enabled: false },
});

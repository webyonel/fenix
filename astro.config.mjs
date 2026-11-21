// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const base = process.env.PUBLIC_BASE_PATH ?? (process.env.GITHUB_ACTIONS === 'true' ? '/fenix' : '');

export default defineConfig({
	site: 'https://webyonel.github.io',
	base,
	integrations: [sitemap({ filter: (page) => !page.includes('/admin/') })],
});

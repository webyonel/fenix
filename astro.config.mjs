// @ts-check
import { defineConfig } from 'astro/config';

const base = process.env.PUBLIC_BASE_PATH ?? (process.env.GITHUB_ACTIONS === 'true' ? '/tuyo-mio' : '');

export default defineConfig({
	site: 'https://webyonel.github.io',
	base,
});

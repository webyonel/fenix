import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
	throw new Error('Faltan PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
}

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
	auth: {
		persistSession: true,
		autoRefreshToken: true,
		detectSessionInUrl: true,
	},
});

export function getMediaUrl(path: string): string {
	if (path.startsWith('/')) {
		const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
		return `${base}${path.replace(/^\/+/, '')}`;
	}
	if (/^https?:\/\//i.test(path)) return path;
	return supabase.storage.from('site-media').getPublicUrl(path).data.publicUrl;
}

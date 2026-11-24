import { getMediaUrl, supabase } from '../supabase/client';
import type { TablesInsert, TablesUpdate } from '../supabase/database.types';

function requireData<T>(data: T | null, error: { message: string } | null): T {
	if (error) throw error;
	if (data === null) throw new Error('Supabase devolvió una respuesta vacía.');
	return data;
}

export async function loadSiteContent() {
	const [settings, categories, plans, products, gallery, busyDates] = await Promise.all([
		supabase.from('site_settings').select('*').eq('id', true).single(),
		supabase.from('plan_categories').select('*').order('position'),
		supabase.from('plans').select('*').order('position').order('created_at'),
		supabase.from('products').select('*').order('position').order('created_at'),
		supabase.from('gallery_items').select('*').order('position').order('created_at'),
		supabase.from('busy_dates').select('date').order('date'),
	]);
	return {
		settings: requireData(settings.data, settings.error),
		categories: requireData(categories.data, categories.error),
		plans: requireData(plans.data, plans.error),
		products: requireData(products.data, products.error),
		gallery: requireData(gallery.data, gallery.error),
		busyDates: requireData(busyDates.data, busyDates.error).map(({ date }) => date),
	};
}

export async function savePlan(values: Omit<TablesInsert<'plans'>, 'id' | 'created_at'>, id?: string) {
	const query = id
		? supabase.from('plans').update(values satisfies TablesUpdate<'plans'>).eq('id', id)
		: supabase.from('plans').insert(values);
	const { error } = await query;
	if (error) throw error;
}

export async function removePlan(id: string) {
	const { error } = await supabase.from('plans').delete().eq('id', id);
	if (error) throw error;
}

export async function saveProduct(values: Omit<TablesInsert<'products'>, 'id' | 'created_at'>, id?: string) {
	const query = id
		? supabase.from('products').update(values satisfies TablesUpdate<'products'>).eq('id', id)
		: supabase.from('products').insert(values);
	const { error } = await query;
	if (error) throw error;
}

export async function removeProduct(id: string) {
	const { error } = await supabase.from('products').delete().eq('id', id);
	if (error) throw error;
}

export async function saveCategoryCover(slug: string, coverPath: string) {
	const { error } = await supabase.from('plan_categories').update({ cover_path: coverPath }).eq('slug', slug);
	if (error) throw error;
}

export async function saveSettings(values: TablesUpdate<'site_settings'>) {
	const { error } = await supabase.from('site_settings').update(values).eq('id', true);
	if (error) throw error;
}

export async function addGalleryImage(imagePath: string, altText: string, position: number) {
	const { error } = await supabase.from('gallery_items').insert({ image_path: imagePath, alt_text: altText, position });
	if (error) throw error;
}

export async function removeGalleryImage(id: string) {
	const { error } = await supabase.from('gallery_items').delete().eq('id', id);
	if (error) throw error;
}

export async function setBusyDate(date: string, busy: boolean) {
	const result = busy
		? await supabase.from('busy_dates').insert({ date })
		: await supabase.from('busy_dates').delete().eq('date', date);
	if (result.error) throw result.error;
}

export async function uploadImage(folder: string, file: File): Promise<string> {
	if (!file.type.startsWith('image/')) throw new Error('Selecciona un archivo de imagen.');
	if (file.size > 12 * 1024 * 1024) throw new Error('La imagen debe pesar menos de 12 MB.');

	const imageUrl = URL.createObjectURL(file);
	try {
		const image = new Image();
		image.src = imageUrl;
		await image.decode();
		const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(image.naturalWidth * scale);
		canvas.height = Math.round(image.naturalHeight * scale);
		const context = canvas.getContext('2d');
		if (!context) throw new Error('No se pudo procesar la imagen.');
		context.drawImage(image, 0, 0, canvas.width, canvas.height);
		const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
			(value) => value ? resolve(value) : reject(new Error('No se pudo optimizar la imagen.')),
			'image/jpeg',
			0.82,
		));
		const path = `${folder}/${crypto.randomUUID()}.jpg`;
		const { error } = await supabase.storage.from('site-media').upload(path, blob, {
			contentType: 'image/jpeg',
			cacheControl: '3600',
			upsert: false,
		});
		if (error) throw error;
		return path;
	} finally {
		URL.revokeObjectURL(imageUrl);
	}
}

export async function removeStoredImage(path: string) {
	if (path.startsWith('/') || /^https?:\/\//i.test(path)) return;
	const { error } = await supabase.storage.from('site-media').remove([path]);
	if (error) throw error;
}

export { getMediaUrl };

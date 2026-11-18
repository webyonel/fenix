import { supabase } from '../../lib/supabase/client';
import {
	addGalleryImage,
	getMediaUrl,
	loadSiteContent,
	removeGalleryImage,
	removePlan,
	removeProduct,
	removeStoredImage,
	saveCategoryCover,
	saveProductCategoryCover,
	savePlan,
	saveProduct,
	saveSettings,
	setBusyDate,
	uploadImage,
} from '../../lib/repositories/contentRepository';
import type { Tables } from '../../lib/supabase/database.types';

type Plan = Tables<'plans'>;
type Product = Tables<'products'>;
type Content = Awaited<ReturnType<typeof loadSiteContent>>;
type EditorType = 'plan' | 'product';

const $ = <T extends HTMLElement>(selector: string, root: ParentNode = document) => root.querySelector<T>(selector);
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
const money = (amount: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(amount);
const imageSource = (path: string) => getMediaUrl(path);
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

let content: Content | null = null;
let selectedCategory = '';
let selectedProductCategory = '';
let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let editing: { type: EditorType; id?: string } | null = null;
let pendingImage: File | null = null;
let pendingImagePreview = '';
let toastTimer = 0;
const formSubmissionLocks = new WeakMap<HTMLFormElement, Array<{ button: HTMLButtonElement; text: string; disabled: boolean }>>();

const adminHeader = $('#admin-header')!;
const adminMain = $('#admin-app')!;
const loginView = $('#admin-login')!;
const loginForm = $('#login-form') as HTMLFormElement;
const editorDialog = $('#editor-dialog') as HTMLDialogElement;
const editorForm = $('#editor-form') as HTMLFormElement;

function notify(message: string, isError = false) {
	const toast = $('#toast')!;
	toast.textContent = message;
	toast.classList.toggle('toast-error', isError);
	toast.classList.add('show');
	window.clearTimeout(toastTimer);
	toastTimer = window.setTimeout(() => toast.classList.remove('show'), 4000);
}

function beginFormSubmission(form: HTMLFormElement, pendingLabel: string): boolean {
	if (formSubmissionLocks.has(form)) return false;
	const buttonStates = [...form.querySelectorAll<HTMLButtonElement>('button')].map((button) => ({
		button,
		text: button.textContent ?? '',
		disabled: button.disabled,
	}));
	formSubmissionLocks.set(form, buttonStates);
	form.setAttribute('aria-busy', 'true');
	for (const { button } of buttonStates) button.disabled = true;
	const submitButton = buttonStates.find(({ button }) => button.type === 'submit')?.button;
	if (submitButton) submitButton.textContent = pendingLabel;
	return true;
}

function endFormSubmission(form: HTMLFormElement) {
	const buttonStates = formSubmissionLocks.get(form);
	if (!buttonStates) return;
	for (const { button, text, disabled } of buttonStates) {
		button.textContent = text;
		button.disabled = disabled;
	}
	formSubmissionLocks.delete(form);
	form.removeAttribute('aria-busy');
}

function showLogin(message = '') {
	content = null;
	adminHeader.hidden = true;
	adminMain.hidden = true;
	loginView.hidden = false;
	$('#login-error')!.textContent = message;
}

async function showAdmin() {
	const { data, error } = await supabase.rpc('is_site_admin');
	if (error || !data) {
		await supabase.auth.signOut();
		showLogin('Esta cuenta no tiene permisos para administrar el sitio.');
		return;
	}
	loginView.hidden = true;
	adminHeader.hidden = false;
	adminMain.hidden = false;
	try {
		content = await loadSiteContent();
		selectedCategory ||= content.categories[0]?.slug ?? '';
		selectedProductCategory ||= content.productCategories[0]?.slug ?? '';
		render();
	} catch (error) {
		showLogin(`No se pudo cargar el contenido: ${error instanceof Error ? error.message : 'error desconocido'}`);
	}
}

function render() {
	if (!content) return;
	$('#plan-count')!.textContent = String(content.plans.length);
	$('#product-count')!.textContent = String(content.products.length);
	$('#gallery-count')!.textContent = String(content.gallery.length);
	renderCategoryCovers();
	renderPlanCategoryFilters();
	renderPlans();
	renderProductCategoryCovers();
	renderProductCategoryFilters();
	renderProducts();
	renderGallery();
	renderAvailability();
	populateSettingsForms();
}

function renderCategoryCovers() {
	if (!content) return;
	$('#category-cover-list')!.innerHTML = content.categories.map((category) => `
		<article class="category-cover-item">
			<img src="${escapeHtml(imageSource(category.cover_path))}" alt="Portada de ${escapeHtml(category.name)}" />
			<div><strong>${escapeHtml(category.name)}</strong><label class="small-button category-cover-upload">Cambiar foto<input type="file" accept="image/*" data-category-cover="${escapeHtml(category.slug)}" /></label></div>
		</article>`).join('');
}

function renderPlanCategoryFilters() {
	if (!content) return;
	$('#admin-plan-categories')!.innerHTML = content.categories.map((category) => {
		const selected = selectedCategory === category.slug;
		const count = content!.plans.filter((plan) => plan.category_slug === category.slug).length;
		return `<button class="category-chip${selected ? ' active' : ''}" type="button" data-admin-category="${escapeHtml(category.slug)}" aria-pressed="${selected}">${escapeHtml(category.name)} <span>${count}</span></button>`;
	}).join('');
}

function renderPlans() {
	if (!content) return;
	const cupPerUsd = Number(content.settings.cup_per_usd);
	const category = content.categories.find(({ slug }) => slug === selectedCategory);
	const plans = content.plans.filter((plan) => plan.category_slug === selectedCategory);
	$('#plans-list')!.innerHTML = plans.length ? plans.map((plan) => `
		<article class="managed-item">
			<img src="${escapeHtml(imageSource(plan.image_path))}" alt="" />
			<div class="item-info"><span class="item-kicker">${escapeHtml(category?.name ?? '')}</span><h3>${escapeHtml(plan.name)}</h3><p>${escapeHtml(plan.description)}</p><div class="item-price">${money(plan.price_usd)} USD · ${money(plan.price_usd * cupPerUsd)} CUP</div></div>
			<div class="item-actions"><button class="small-button" type="button" data-action="edit-plan" data-id="${plan.id}">Editar</button><button class="small-button delete" type="button" data-action="delete-plan" data-id="${plan.id}">Eliminar</button></div>
		</article>`).join('') : `<div class="empty-state">Aún no hay ofertas en “${escapeHtml(category?.name ?? '')}”. Puedes agregarlas con el botón superior.</div>`;
}

function renderProducts() {
	if (!content) return;
	const cupPerUsd = Number(content.settings.cup_per_usd);
	const category = content.productCategories.find(({ slug }) => slug === selectedProductCategory);
	const products = selectedProductCategory === 'uncategorized'
		? content.products.filter((product) => product.category_slug === null)
		: content.products.filter((product) => product.category_slug === selectedProductCategory);
	$('#products-list')!.innerHTML = products.length ? products.map((product) => `
		<article class="managed-item"><img src="${escapeHtml(imageSource(product.image_path))}" alt="" />
			<div class="item-info"><span class="item-kicker">${escapeHtml(product.category_slug ? category?.name ?? 'PRODUCTO' : 'SIN CATEGORÍA')}</span><h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.description)}</p><div class="item-price">${money(product.price_usd)} USD · ${money(product.price_usd * cupPerUsd)} CUP</div></div>
			<div class="item-actions"><button class="small-button" type="button" data-action="edit-product" data-id="${product.id}">Editar</button><button class="small-button delete" type="button" data-action="delete-product" data-id="${product.id}">Eliminar</button></div>
		</article>`).join('') : '<div class="empty-state">Aún no hay productos. Usa “Agregar producto” para crear uno.</div>';
}

function renderProductCategoryCovers() {
	if (!content) return;
	$('#product-category-cover-list')!.innerHTML = content.productCategories.map((category) => `
		<article class="category-cover-item">
			<img src="${escapeHtml(imageSource(category.cover_path))}" alt="Portada de ${escapeHtml(category.name)}" />
			<div><strong>${escapeHtml(category.name)}</strong><label class="small-button category-cover-upload">Cambiar foto<input type="file" accept="image/*" data-product-category-cover="${escapeHtml(category.slug)}" /></label></div>
		</article>`).join('');
}

function renderProductCategoryFilters() {
	if (!content) return;
	const filters = content.productCategories.map((category) => {
		const selected = selectedProductCategory === category.slug;
		const count = content!.products.filter((product) => product.category_slug === category.slug).length;
		return `<button class="category-chip${selected ? ' active' : ''}" type="button" data-product-admin-category="${escapeHtml(category.slug)}" aria-pressed="${selected}">${escapeHtml(category.name)} <span>${count}</span></button>`;
	});
	const uncategorizedCount = content.products.filter((product) => product.category_slug === null).length;
	if (uncategorizedCount) {
		const selected = selectedProductCategory === 'uncategorized';
		filters.push(`<button class="category-chip${selected ? ' active' : ''}" type="button" data-product-admin-category="uncategorized" aria-pressed="${selected}">Sin categoría <span>${uncategorizedCount}</span></button>`);
	}
	$('#admin-product-categories')!.innerHTML = filters.join('');
}

function renderGallery() {
	if (!content) return;
	$('#gallery-list')!.innerHTML = content.gallery.length ? content.gallery.map((item) => `
		<div class="gallery-item"><img src="${escapeHtml(imageSource(item.image_path))}" alt="${escapeHtml(item.alt_text)}" loading="lazy" /><button type="button" aria-label="Eliminar imagen" data-action="delete-image" data-id="${item.id}">×</button></div>`).join('') : '<div class="empty-state">La galería está vacía. Agrega algunas imágenes para mostrarlas en el sitio.</div>';
}

function renderAvailability() {
	if (!content) return;
	const title = calendarMonth.toLocaleDateString('es', { month: 'long', year: 'numeric' });
	$('#admin-calendar-month')!.textContent = title.charAt(0).toUpperCase() + title.slice(1);
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	$('#admin-calendar-prev')!.toggleAttribute('disabled', calendarMonth.getFullYear() === today.getFullYear() && calendarMonth.getMonth() === today.getMonth());
	const offset = (calendarMonth.getDay() + 6) % 7;
	const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
	const cells = Array.from({ length: offset }, () => '<span class="calendar-blank" aria-hidden="true"></span>');
	const busyDates = new Set(content.busyDates);
	for (let day = 1; day <= daysInMonth; day += 1) {
		const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
		const key = dateKey(date);
		const sunday = date.getDay() === 0;
		const past = date < today;
		const busy = busyDates.has(key);
		cells.push(`<button class="calendar-day${busy ? ' busy' : ''}${sunday ? ' sunday' : ''}" type="button" data-admin-date="${key}" aria-label="${day}, ${sunday ? 'domingo cerrado' : busy ? 'ocupado, pulsa para habilitar' : 'disponible, pulsa para ocupar'}"${sunday || past ? ' disabled' : ''}>${day}</button>`);
	}
	$('#admin-calendar-days')!.innerHTML = cells.join('');
}

function populateSettingsForms() {
	if (!content) return;
	const settings = content.settings;
	($('#hero-title-line-input') as HTMLInputElement).value = settings.hero_title_line;
	($('#hero-title-emphasis-input') as HTMLInputElement).value = settings.hero_title_emphasis;
	($('#hero-text-color') as HTMLInputElement).value = settings.hero_text_color;
	($('#hero-image-value') as HTMLInputElement).value = settings.hero_image_path;
	($('#hero-image-preview') as HTMLImageElement).src = imageSource(settings.hero_image_path);
	($('#about-editor-paragraphs') as HTMLTextAreaElement).value = settings.about_paragraphs.join('\n\n');
	($('#about-image-value') as HTMLInputElement).value = settings.about_image_path;
	($('#about-image-preview') as HTMLImageElement).src = imageSource(settings.about_image_path);
	($('#cup-per-usd') as HTMLInputElement).value = String(settings.cup_per_usd);
}

function switchTab(tab: HTMLButtonElement) {
	const id = tab.dataset.panel;
	document.querySelectorAll<HTMLButtonElement>('.admin-tab').forEach((item) => {
		const selected = item === tab;
		item.classList.toggle('active', selected);
		item.setAttribute('aria-selected', String(selected));
	});
	document.querySelectorAll<HTMLElement>('[data-admin-panel]').forEach((panel) => panel.classList.toggle('active', panel.dataset.adminPanel === id));
}

function openEditor(type: EditorType, item?: Plan | Product) {
	if (!content) return;
	editing = { type, id: item?.id };
	pendingImage = null;
	pendingImagePreview = '';
	const isPlan = type === 'plan';
	const categories = isPlan ? content.categories : content.productCategories;
	const currentCategory = isPlan ? (item as Plan | undefined)?.category_slug : (item as Product | undefined)?.category_slug ?? '';
	const initialCategory = item ? currentCategory : isPlan ? selectedCategory : selectedProductCategory;
	$('#form-kicker')!.textContent = item ? 'EDITAR CONTENIDO' : 'NUEVO CONTENIDO';
	$('#form-title')!.textContent = `${item ? 'Editar' : 'Agregar'} ${isPlan ? 'plan' : 'producto'}`;
	const categoryOptions = categories.map((category) => `<option value="${escapeHtml(category.slug)}"${initialCategory === category.slug ? ' selected' : ''}>${escapeHtml(category.name)}</option>`).join('');
	const emptyCategoryOption = !initialCategory ? '<option value="" selected disabled>Selecciona una categoría</option>' : '';
	const categoryField = `<div class="field"><label for="item-category">Categoría</label><select id="item-category" name="category" required>${emptyCategoryOption}${categoryOptions}</select></div>`;
	const featuresField = isPlan ? `<div class="field full"><label for="item-features">Características</label><textarea id="item-features" name="features" placeholder="Una característica por línea" required>${escapeHtml((item as Plan | undefined)?.features.join('\n') ?? '')}</textarea><span class="field-hint">Una característica por línea. El precio en CUP usa el cambio configurado en Productos.</span></div>` : '';
	const existingImage = item?.image_path ?? '';
	$('#form-fields')!.innerHTML = `${categoryField}
		<div class="field"><label for="item-price">Precio (USD)</label><input id="item-price" name="price" type="number" min="0" step="0.01" required value="${item ? item.price_usd : ''}" /></div>
		<div class="field full"><label for="item-name">Nombre</label><input id="item-name" name="name" required maxlength="70" value="${escapeHtml(item?.name ?? '')}" /></div>
		<div class="field full"><label for="item-description">Descripción</label><textarea id="item-description" name="description" maxlength="240" required>${escapeHtml(item?.description ?? '')}</textarea></div>
		${featuresField}
		<div class="field full"><label for="item-image-file">Fotografía</label><div class="image-picker"><img id="item-image-preview" src="${existingImage ? escapeHtml(imageSource(existingImage)) : '/img/hero-fenix.webp'}" alt="Vista previa de la fotografía" /><input id="item-image-file" type="file" accept="image/*" ${item ? '' : 'required'} /><input id="item-image" name="image" type="hidden" value="${escapeHtml(existingImage)}" /></div><span class="field-hint">La imagen se optimizará y se guardará en Supabase Storage.</span></div>`;
	$('#form-fields')!.querySelector<HTMLInputElement>('#item-image-file')!.addEventListener('change', (event) => {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		pendingImage = file;
		if (pendingImagePreview) URL.revokeObjectURL(pendingImagePreview);
		pendingImagePreview = URL.createObjectURL(file);
		($('#item-image-preview') as HTMLImageElement).src = pendingImagePreview;
	});
	editorDialog.showModal();
}

async function persistEditor(event: SubmitEvent) {
	event.preventDefault();
	if (!editing || !content || !beginFormSubmission(editorForm, 'Guardando…')) return;
	try {
		await persistEditorChanges();
	} finally {
		endFormSubmission(editorForm);
	}
}

async function persistEditorChanges() {
	if (!editing || !content) return;
	const form = new FormData(editorForm);
	const isPlan = editing.type === 'plan';
	const id = editing.id;
	const oldItem = isPlan ? content.plans.find((plan) => plan.id === id) : content.products.find((product) => product.id === id);
	let imagePath = String(form.get('image') ?? '');
	if (pendingImage) imagePath = await uploadImage(isPlan ? 'plans' : 'products', pendingImage);
	if (!imagePath) throw new Error('Selecciona una fotografía para el elemento.');
	const name = String(form.get('name') ?? '').trim();
	const description = String(form.get('description') ?? '').trim();
	const price = Number(form.get('price'));
	if (!Number.isFinite(price) || price < 0) throw new Error('El precio debe ser un número válido.');
	if (isPlan) {
		const values = {
			category_slug: String(form.get('category')),
			name,
			description,
			features: String(form.get('features') ?? '').split('\n').map((value) => value.trim()).filter(Boolean),
			price_usd: price,
			image_path: imagePath,
			position: oldItem?.position ?? content.plans.filter((plan) => plan.category_slug === String(form.get('category'))).length,
		};
		await savePlan(values, id);
		selectedCategory = values.category_slug;
	} else {
		const categorySlug = String(form.get('category') ?? '');
		if (!categorySlug) throw new Error('Selecciona una categoría para el producto.');
		await saveProduct({
			category_slug: categorySlug,
			name,
			description,
			price_usd: price,
			image_path: imagePath,
			position: oldItem?.position ?? content.products.length,
		}, id);
		selectedProductCategory = categorySlug;
	}
	if (pendingImage && oldItem?.image_path) await removeStoredImage(oldItem.image_path).catch(() => undefined);
	pendingImage = null;
	pendingImagePreview = '';
	editorDialog.close();
	await refreshContent();
	notify(isPlan ? 'Plan guardado.' : 'Producto guardado.');
}

async function refreshContent() {
	content = await loadSiteContent();
	if (!content.categories.some(({ slug }) => slug === selectedCategory)) selectedCategory = content.categories[0]?.slug ?? '';
	if (!content.productCategories.some(({ slug }) => slug === selectedProductCategory) && selectedProductCategory !== 'uncategorized') selectedProductCategory = content.productCategories[0]?.slug ?? '';
	if (selectedProductCategory === 'uncategorized' && !content.products.some((product) => product.category_slug === null)) selectedProductCategory = content.productCategories[0]?.slug ?? '';
	render();
}

async function removeItem(type: 'plan' | 'product' | 'gallery', id: string) {
	if (!content) return;
	const label = type === 'plan' ? 'este plan' : type === 'product' ? 'este producto' : 'esta imagen de la galería';
	if (!window.confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)) return;
	if (type === 'plan') {
		const item = content.plans.find((plan) => plan.id === id);
		await removePlan(id);
		if (item) await removeStoredImage(item.image_path).catch(() => undefined);
	} else if (type === 'product') {
		const item = content.products.find((product) => product.id === id);
		await removeProduct(id);
		if (item) await removeStoredImage(item.image_path).catch(() => undefined);
	} else {
		const item = content.gallery.find((image) => image.id === id);
		await removeGalleryImage(id);
		if (item) await removeStoredImage(item.image_path).catch(() => undefined);
	}
	await refreshContent();
	notify('Elemento eliminado.');
}

async function handleSettingsSubmit(event: SubmitEvent, section: 'hero' | 'about') {
	event.preventDefault();
	const form = event.currentTarget as HTMLFormElement;
	if (!content || !beginFormSubmission(form, 'Guardando…')) return;
	try {
		await persistSettingsForm(form, section);
	} finally {
		endFormSubmission(form);
	}
}

async function persistSettingsForm(form: HTMLFormElement, section: 'hero' | 'about') {
	if (!content) return;
	const values = new FormData(form);
	const imageField = section === 'hero' ? '#hero-image-file' : '#about-image-file';
	const imageInput = $(imageField) as HTMLInputElement;
	const file = imageInput.files?.[0];
	const existingPath = section === 'hero' ? content.settings.hero_image_path : content.settings.about_image_path;
	const imagePath = file ? await uploadImage(section, file) : existingPath;
	if (section === 'hero') {
		await saveSettings({
			hero_title_line: String(values.get('titleLine')).trim(),
			hero_title_emphasis: String(values.get('titleEmphasis')).trim(),
			hero_text_color: String(values.get('textColor')),
			hero_image_path: imagePath,
		});
	} else {
		const paragraphs = String(values.get('paragraphs') ?? '').split(/\n\s*\n/).map((value) => value.trim()).filter(Boolean);
		if (!paragraphs.length) throw new Error('Escribe al menos un párrafo para la sección.');
		await saveSettings({ about_paragraphs: paragraphs, about_image_path: imagePath });
	}
	if (file && existingPath !== imagePath) await removeStoredImage(existingPath).catch(() => undefined);
	form.reset();
	imageInput.value = '';
	await refreshContent();
	notify('Cambios guardados.');
}

async function handleExchangeRateSubmit(event: SubmitEvent) {
	event.preventDefault();
	const form = event.currentTarget as HTMLFormElement;
	if (!beginFormSubmission(form, 'Guardando…')) return;
	try {
		const cupPerUsd = Number(new FormData(form).get('cupPerUsd'));
		if (!Number.isFinite(cupPerUsd) || cupPerUsd <= 0) throw new Error('El valor de cambio debe ser mayor que cero.');
		await saveSettings({ cup_per_usd: cupPerUsd });
		await refreshContent();
		notify(`Cambio actualizado: 1 USD = ${money(cupPerUsd)} CUP.`);
	} finally {
		endFormSubmission(form);
	}
}

async function handleCategoryCover(event: Event) {
	if (!content) return;
	const input = event.target as HTMLInputElement;
	const slug = input.dataset.categoryCover;
	const file = input.files?.[0];
	if (!slug || !file) return;
	const category = content.categories.find((item) => item.slug === slug);
	if (!category) return;
	const path = await uploadImage('categories', file);
	await saveCategoryCover(slug, path);
	await removeStoredImage(category.cover_path).catch(() => undefined);
	await refreshContent();
	notify('Portada de categoría actualizada.');
}

async function handleProductCategoryCover(event: Event) {
	if (!content) return;
	const input = event.target as HTMLInputElement;
	const slug = input.dataset.productCategoryCover;
	const file = input.files?.[0];
	if (!slug || !file) return;
	const category = content.productCategories.find((item) => item.slug === slug);
	if (!category) return;
	const path = await uploadImage('categories', file);
	await saveProductCategoryCover(slug, path);
	await removeStoredImage(category.cover_path).catch(() => undefined);
	await refreshContent();
	notify('Portada de categoría de productos actualizada.');
}

async function handleGalleryUpload(event: Event) {
	if (!content) return;
	const input = event.target as HTMLInputElement;
	const files = [...(input.files ?? [])];
	if (!files.length) return;
	for (const file of files) {
		const path = await uploadImage('gallery', file);
		await addGalleryImage(path, file.name.replace(/\.[^.]+$/, ''), content.gallery.length);
		content.gallery.length += 1;
	}
	input.value = '';
	await refreshContent();
	notify(files.length === 1 ? 'Imagen agregada a la galería.' : 'Imágenes agregadas a la galería.');
}

async function handleCalendarClick(event: Event) {
	const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-admin-date]');
	if (!button || button.disabled || !content) return;
	const date = button.dataset.adminDate!;
	await setBusyDate(date, !content.busyDates.includes(date));
	await refreshContent();
}

loginForm.addEventListener('submit', async (event) => {
	event.preventDefault();
	if (!beginFormSubmission(loginForm, 'Comprobando…')) return;
	$('#login-error')!.textContent = '';
	try {
		const values = new FormData(loginForm);
		const { error } = await supabase.auth.signInWithPassword({ email: String(values.get('email')).trim(), password: String(values.get('password')) });
		if (error) throw error;
		await showAdmin();
	} catch (error) {
		$('#login-error')!.textContent = error instanceof Error ? error.message : 'No se pudo iniciar sesión.';
	} finally {
		endFormSubmission(loginForm);
	}
});

$('#admin-signout')!.addEventListener('click', async () => {
	await supabase.auth.signOut();
	showLogin();
});

document.querySelectorAll<HTMLButtonElement>('.admin-tab').forEach((tab) => tab.addEventListener('click', () => switchTab(tab)));
document.querySelectorAll<HTMLButtonElement>('[data-create="plan"]').forEach((button) => button.addEventListener('click', () => openEditor('plan')));
document.querySelectorAll<HTMLButtonElement>('[data-create="product"]').forEach((button) => button.addEventListener('click', () => openEditor('product')));
$('#admin-plan-categories')!.addEventListener('click', (event) => {
	const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-admin-category]');
	if (!button) return;
	selectedCategory = button.dataset.adminCategory!;
	renderPlanCategoryFilters();
	renderPlans();
});
$('#category-cover-list')!.addEventListener('change', (event) => void handleCategoryCover(event).catch((error) => notify(error.message, true)));
$('#product-category-cover-list')!.addEventListener('change', (event) => void handleProductCategoryCover(event).catch((error) => notify(error.message, true)));
$('#admin-product-categories')!.addEventListener('click', (event) => {
	const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-product-admin-category]');
	if (!button) return;
	selectedProductCategory = button.dataset.productAdminCategory!;
	renderProductCategoryFilters();
	renderProducts();
});
$('#gallery-upload')!.addEventListener('change', (event) => void handleGalleryUpload(event).catch((error) => notify(error.message, true)));
$('#admin-calendar-days')!.addEventListener('click', (event) => void handleCalendarClick(event).catch((error) => notify(error.message, true)));
$('#admin-calendar-prev')!.addEventListener('click', () => {
	calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
	renderAvailability();
});
$('#admin-calendar-next')!.addEventListener('click', () => {
	calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
	renderAvailability();
});
$('#plans-list')!.addEventListener('click', (event) => {
	const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
	if (!button || !content) return;
	const plan = content.plans.find((item) => item.id === button.dataset.id);
	if (button.dataset.action === 'edit-plan' && plan) openEditor('plan', plan);
	if (button.dataset.action === 'delete-plan') void removeItem('plan', button.dataset.id!).catch((error) => notify(error.message, true));
});
$('#products-list')!.addEventListener('click', (event) => {
	const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
	if (!button || !content) return;
	const product = content.products.find((item) => item.id === button.dataset.id);
	if (button.dataset.action === 'edit-product' && product) openEditor('product', product);
	if (button.dataset.action === 'delete-product') void removeItem('product', button.dataset.id!).catch((error) => notify(error.message, true));
});
$('#gallery-list')!.addEventListener('click', (event) => {
	const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action="delete-image"]');
	if (button) void removeItem('gallery', button.dataset.id!).catch((error) => notify(error.message, true));
});
editorForm.addEventListener('submit', (event) => void persistEditor(event as SubmitEvent).catch((error) => notify(error.message, true)));
$('#cancel-edit')!.addEventListener('click', () => editorDialog.close());
$('.close-dialog')!.addEventListener('click', () => editorDialog.close());
editorDialog.addEventListener('click', (event) => { if (event.target === editorDialog) editorDialog.close(); });
$('#hero-form')!.addEventListener('submit', (event) => void handleSettingsSubmit(event as SubmitEvent, 'hero').catch((error) => notify(error.message, true)));
$('#about-form')!.addEventListener('submit', (event) => void handleSettingsSubmit(event as SubmitEvent, 'about').catch((error) => notify(error.message, true)));
$('#exchange-rate-form')!.addEventListener('submit', (event) => void handleExchangeRateSubmit(event as SubmitEvent).catch((error) => notify(error.message, true)));

supabase.auth.getSession().then(({ data, error }) => {
	if (error) showLogin('No se pudo comprobar la sesión. Inicia sesión de nuevo.');
	else if (data.session) void showAdmin();
	else showLogin();
});
supabase.auth.onAuthStateChange((event) => {
	if (event === 'SIGNED_OUT') showLogin();
});

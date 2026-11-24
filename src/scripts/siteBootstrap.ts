import { getMediaUrl, loadSiteContent } from '../lib/repositories/contentRepository';
import { supabase } from '../lib/supabase/client';
import type { Tables } from '../lib/supabase/database.types';

type PublicPlan = Tables<'plans'>;
type SiteContent = Awaited<ReturnType<typeof loadSiteContent>>;

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
const money = (amount: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(amount);
const imageUrl = (path: string) => getMediaUrl(path);
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

let siteContent: SiteContent | null = null;
let selectedBookingPlan: PublicPlan | null = null;
let selectedBookingDate = '';
let bookingMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

const plansDialog = document.querySelector<HTMLDialogElement>('#plans-dialog');
const bookingDialog = document.querySelector<HTMLDialogElement>('#booking-dialog');
const productsDialog = document.querySelector<HTMLDialogElement>('#products-dialog');

function applySettings(content: SiteContent) {
	const { settings } = content;
	const titleLine = document.querySelector<HTMLElement>('#hero-title-line');
	const titleEmphasis = document.querySelector<HTMLElement>('#hero-title-emphasis');
	const hero = document.querySelector<HTMLElement>('.hero');
	const heroImage = document.querySelector<HTMLImageElement>('#hero-image');
	const aboutImage = document.querySelector<HTMLImageElement>('#about-image');
	const productsCardImage = document.querySelector<HTMLImageElement>('#products-card-image');
	if (titleLine) titleLine.textContent = settings.hero_title_line;
	if (titleEmphasis) titleEmphasis.textContent = settings.hero_title_emphasis;
	if (hero) {
		hero.style.setProperty('--hero-title-color', settings.hero_text_color);
		hero.style.setProperty('--hero-background-image', `url("${imageUrl(settings.hero_image_path).replace(/["\\\n\r]/g, '')}")`);
	}
	if (heroImage) {
		heroImage.src = imageUrl(settings.hero_image_path);
		heroImage.alt = settings.hero_image_alt;
	}
	if (aboutImage) {
		aboutImage.src = imageUrl(settings.about_image_path);
		aboutImage.alt = settings.about_image_alt;
	}
	if (productsCardImage) {
		productsCardImage.src = imageUrl(settings.products_card_image_path);
		productsCardImage.alt = settings.products_card_image_alt;
	}
	const paragraphs = document.querySelector<HTMLElement>('#about-paragraphs');
	if (paragraphs) paragraphs.innerHTML = settings.about_paragraphs.map((text) => `<p>${escapeHtml(text)}</p>`).join('');
}

function renderCategories(content: SiteContent) {
	const container = document.querySelector<HTMLElement>('#plan-categories');
	if (!container) return;
	container.innerHTML = content.categories.map((category) => {
		const count = content.plans.filter((plan) => plan.category_slug === category.slug).length;
		return `<button class="category-card" type="button" data-plan-category="${escapeHtml(category.slug)}" aria-label="Ver ${count} ${count === 1 ? 'oferta' : 'ofertas'} de ${escapeHtml(category.name)}">
			<img src="${escapeHtml(imageUrl(category.cover_path))}" alt="" loading="lazy" /><span class="category-card-shade"></span>
			<span class="category-card-copy"><strong>${escapeHtml(category.name)}</strong><small>${count} ${count === 1 ? 'oferta' : 'ofertas'} <i>↗</i></small></span>
		</button>`;
	}).join('');
}

function renderProducts() {
	if (!siteContent) return;
	const container = document.querySelector<HTMLElement>('#public-product-list');
	if (!container) return;
	const cupPerUsd = Number(siteContent.settings.cup_per_usd);
	container.innerHTML = siteContent.products.length ? siteContent.products.map((product) => {
		const message = encodeURIComponent(`Me interesa ${product.name}`);
		return `<article class="product"><img src="${escapeHtml(imageUrl(product.image_path))}" alt="${escapeHtml(product.name)}" loading="lazy" /><div>
			<h3>${escapeHtml(product.name)}</h3><p>${escapeHtml(product.description)}</p>
			<span>${money(product.price_usd)} USD <i>·</i> ${money(product.price_usd * cupPerUsd)} CUP</span>
			<a class="text-link product-link" href="https://wa.me/5352564951?text=${message}" target="_blank" rel="noopener noreferrer">Me interesa <span>↗</span></a>
		</div></article>`;
	}).join('') : '<p class="category-empty">Aún no hay productos disponibles. Escríbenos para consultar.</p>';
	productsDialog?.showModal();
}

function renderGallery(content: SiteContent) {
	const container = document.querySelector<HTMLElement>('#managed-gallery');
	if (!container) return;
	const images = [...content.gallery, ...content.gallery];
	container.innerHTML = images.map((item, index) => `<img src="${escapeHtml(imageUrl(item.image_path))}" alt="${escapeHtml(item.alt_text)}" ${index >= content.gallery.length ? 'aria-hidden="true"' : ''} loading="${index < content.gallery.length ? 'lazy' : 'eager'}" decoding="async" />`).join('');
	container.classList.add('is-loading');
	const allImages = [...container.querySelectorAll('img')];
	Promise.all(allImages.map((image) => image.decode().catch(() => undefined))).then(() => container.classList.remove('is-loading'));
}

function renderPlans(categorySlug: string) {
	if (!siteContent || !plansDialog) return;
	const category = siteContent.categories.find(({ slug }) => slug === categorySlug);
	if (!category) return;
	const heading = document.querySelector<HTMLElement>('#plans-dialog-heading');
	const list = document.querySelector<HTMLElement>('#public-plan-list');
	if (!heading || !list) return;
	const cupPerUsd = Number(siteContent.settings.cup_per_usd);
	heading.textContent = `Planes de ${category.name}`;
	const plans = siteContent.plans.filter((plan) => plan.category_slug === categorySlug);
	list.innerHTML = plans.length ? plans.map((plan) => `
		<article class="plan-card"><img class="plan-card-image" src="${escapeHtml(imageUrl(plan.image_path))}" alt="${escapeHtml(plan.name)}" loading="lazy" />
			<span class="plan-number">${escapeHtml(category.name.toLocaleUpperCase('es'))}</span><h3>${escapeHtml(plan.name)}</h3><p>${escapeHtml(plan.description)}</p>
			<ul>${plan.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join('')}</ul>
			<div class="price"><strong>${money(plan.price_usd)} USD</strong><span>${money(plan.price_usd * cupPerUsd)} CUP</span></div>
			<a class="text-link" href="#reservar" data-book-plan="${plan.id}">Me interesa este plan <span>↗</span></a>
		</article>`).join('') : `<p class="category-empty">Aún no hay ofertas en “<strong>${escapeHtml(category.name)}</strong>”. Escríbenos para consultar.</p>`;
	plansDialog.showModal();
}

function renderBookingCalendar() {
	if (!siteContent) return;
	const monthElement = document.querySelector<HTMLElement>('#booking-month');
	const daysElement = document.querySelector<HTMLElement>('#booking-days');
	const selectedElement = document.querySelector<HTMLElement>('#booking-selected');
	const confirmButton = document.querySelector<HTMLButtonElement>('#booking-confirm');
	if (!monthElement || !daysElement || !selectedElement || !confirmButton) return;
	const monthTitle = bookingMonth.toLocaleDateString('es', { month: 'long', year: 'numeric' });
	monthElement.textContent = monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1);
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const previous = document.querySelector<HTMLButtonElement>('#booking-prev');
	if (previous) previous.disabled = bookingMonth.getFullYear() === today.getFullYear() && bookingMonth.getMonth() === today.getMonth();
	const offset = (bookingMonth.getDay() + 6) % 7;
	const daysInMonth = new Date(bookingMonth.getFullYear(), bookingMonth.getMonth() + 1, 0).getDate();
	const busyDates = new Set(siteContent.busyDates);
	const cells = Array.from({ length: offset }, () => '<span class="calendar-blank" aria-hidden="true"></span>');
	for (let day = 1; day <= daysInMonth; day += 1) {
		const date = new Date(bookingMonth.getFullYear(), bookingMonth.getMonth(), day);
		const key = dateKey(date);
		const sunday = date.getDay() === 0;
		const past = date < today;
		const busy = busyDates.has(key);
		const selected = selectedBookingDate === key;
		const disabled = sunday || past || busy;
		const label = sunday ? `${day}, domingo: no se trabaja` : busy ? `${day}, ocupado` : `${day}, disponible`;
		cells.push(`<button class="calendar-day${busy ? ' busy' : ''}${sunday ? ' sunday' : ''}${selected ? ' selected' : ''}" type="button" data-booking-date="${key}" aria-label="${label}"${disabled ? ' disabled' : ''}${selected ? ' aria-pressed="true"' : ''}>${day}</button>`);
	}
	daysElement.innerHTML = cells.join('');
	selectedElement.textContent = selectedBookingDate
		? `Fecha elegida: ${new Date(`${selectedBookingDate}T12:00:00`).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`
		: 'Selecciona un día disponible.';
	confirmButton.disabled = !selectedBookingDate;
}

async function openBooking(planId: string) {
	if (!siteContent || !bookingDialog) return;
	const plan = siteContent.plans.find((item) => item.id === planId);
	if (!plan) return;
	selectedBookingPlan = plan;
	selectedBookingDate = '';
	bookingMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
	document.querySelector<HTMLElement>('#booking-plan-name')!.textContent = plan.name;
	renderBookingCalendar();
	if (plansDialog?.open) plansDialog.close();
	bookingDialog.showModal();
}

async function confirmBooking() {
	if (!selectedBookingPlan || !selectedBookingDate || !bookingDialog) return;
	const chosenDate = new Date(`${selectedBookingDate}T12:00:00`);
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	if (chosenDate.getDay() === 0 || chosenDate < today) {
		selectedBookingDate = '';
		renderBookingCalendar();
		return;
	}
	const { data, error } = await supabase.from('busy_dates').select('date').eq('date', selectedBookingDate).maybeSingle();
	if (error) throw error;
	if (data) {
		if (siteContent && !siteContent.busyDates.includes(selectedBookingDate)) siteContent.busyDates.push(selectedBookingDate);
		selectedBookingDate = '';
		renderBookingCalendar();
		document.querySelector<HTMLElement>('#booking-selected')!.textContent = 'Ese día ya no está disponible. Elige otra fecha.';
		return;
	}
	const date = chosenDate.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
	const message = encodeURIComponent(`Me interesa la oferta ${selectedBookingPlan.name} para el día ${date}.`);
	window.open(`https://wa.me/5352564951?text=${message}`, '_blank', 'noopener,noreferrer');
	bookingDialog.close();
}

function bindInteractions() {
	document.querySelector('#plan-categories')?.addEventListener('click', (event) => {
		const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-plan-category]');
		if (button?.dataset.planCategory) renderPlans(button.dataset.planCategory);
	});
	document.querySelector('#products-card')?.addEventListener('click', () => renderProducts());
	document.querySelector('#public-plan-list')?.addEventListener('click', (event) => {
		const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('[data-book-plan]');
		if (link?.dataset.bookPlan) {
			event.preventDefault();
			void openBooking(link.dataset.bookPlan);
		}
	});
	document.querySelector('#booking-days')?.addEventListener('click', (event) => {
		const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-booking-date]');
		if (!button || button.disabled || !button.dataset.bookingDate) return;
		selectedBookingDate = button.dataset.bookingDate;
		renderBookingCalendar();
	});
	document.querySelector('#booking-prev')?.addEventListener('click', () => {
		bookingMonth = new Date(bookingMonth.getFullYear(), bookingMonth.getMonth() - 1, 1);
		renderBookingCalendar();
	});
	document.querySelector('#booking-next')?.addEventListener('click', () => {
		bookingMonth = new Date(bookingMonth.getFullYear(), bookingMonth.getMonth() + 1, 1);
		renderBookingCalendar();
	});
	document.querySelector('#booking-confirm')?.addEventListener('click', () => void confirmBooking().catch((error) => console.error('No se pudo comprobar la disponibilidad.', error)));
	document.querySelector('#booking-close')?.addEventListener('click', () => bookingDialog?.close());
	document.querySelector('#plans-dialog-close')?.addEventListener('click', () => plansDialog?.close());
	document.querySelector('#products-dialog-close')?.addEventListener('click', () => productsDialog?.close());
	for (const dialog of [plansDialog, bookingDialog, productsDialog]) {
		dialog?.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
	}
}

async function initializePublicContent() {
	try {
		siteContent = await loadSiteContent();
		applySettings(siteContent);
		renderCategories(siteContent);
		renderGallery(siteContent);
	} catch (error) {
		console.error('No se pudo cargar el contenido de Supabase; se mantiene el contenido de respaldo.', error);
	}
}

bindInteractions();
void initializePublicContent();

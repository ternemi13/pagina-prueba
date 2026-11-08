const fs = require('fs');
const path = require('path');
const { asyncHandler } = require('../utils/errors');
const { getPublicSettings } = require('../services/settings');
const { getPublicServices } = require('../services/services');
const { getPublicBarbers } = require('../services/barbers');
const { renderTemplate, escapeHtml, safeJsonForHtml } = require('../utils/template');
const { formatCurrency, weekdayOf, todayStr } = require('../utils/datetime');
const { issueCsrfToken } = require('../middleware/csrf');

const viewsDir = path.join(__dirname, '../../views');
const publicDir = path.join(__dirname, '../../public');

function readView(name) {
  return fs.readFileSync(path.join(viewsDir, name), 'utf8');
}

function absoluteUrl(base, value) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `${String(base || '').replace(/\/$/, '')}/${String(value).replace(/^\//, '')}`;
}

function sanitizeNext(value) {
  if (typeof value !== 'string') return '/admin';
  if (!value.startsWith('/') || value.startsWith('//')) return '/admin';
  return value;
}

function buildServicesHtml(services) {
  if (services.length === 0) {
    return '<p class="empty-state">Todavía no hay servicios publicados.</p>';
  }
  return services
    .map(
      (service) => `
      <article class="service-card">
        <div class="service-card__top">
          <h3>${escapeHtml(service.name)}</h3>
          <span class="price">${escapeHtml(formatCurrency(service.price))}</span>
        </div>
        <p>${escapeHtml(service.description || 'Servicio profesional con acabado de barbería.')}</p>
        <p class="service-card__meta">${Number(service.duration_minutes)} minutos</p>
        <a class="btn btn--ghost btn--small" href="/reservar?servicio=${Number(service.id)}">Reservar</a>
      </article>`
    )
    .join('');
}

function buildBarbersHtml(barbers) {
  if (barbers.length === 0) {
    return '<p class="empty-state">Muy pronto anunciaremos nuestro equipo.</p>';
  }
  return barbers
    .map(
      (barber) => `
      <article class="team-card">
        <div class="team-card__photo">
          <img src="${escapeHtml(barber.photo_url || '/img/barber-placeholder.svg')}"
               alt="Retrato de ${escapeHtml(barber.name)}" loading="lazy">
        </div>
        <div class="team-card__body">
          <h3>${escapeHtml(barber.name)}</h3>
          <p>${escapeHtml(barber.bio || 'Barbero profesional de nuestro equipo.')}</p>
          <a class="text-link" href="/reservar?barbero=${Number(barber.id)}">Reservar con ${escapeHtml(barber.name)}</a>
        </div>
      </article>`
    )
    .join('');
}

function buildGalleryHtml(images) {
  if (images.length === 0) return '';
  return images
    .map(
      (image) => `
      <figure class="gallery-item">
        <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}" loading="lazy">
      </figure>`
    )
    .join('');
}

function buildHoursHtml(hoursDisplay) {
  const today = weekdayOf(todayStr());
  return hoursDisplay
    .map((item) => {
      const isToday = item.weekday === today;
      const value = item.closed
        ? 'Cerrado'
        : `${escapeHtml(item.start)} - ${escapeHtml(item.end)}`;
      return `<li class="${isToday ? 'is-today' : ''}">
        <span>${escapeHtml(item.day)}${isToday ? ' <small>(hoy)</small>' : ''}</span>
        <strong>${value}</strong>
      </li>`;
    })
    .join('');
}

function buildSocialHtml(values) {
  const links = [];
  if (values.instagram_url) {
    links.push(
      `<a href="${escapeHtml(values.instagram_url)}" target="_blank" rel="noopener noreferrer">Instagram</a>`
    );
  }
  if (values.facebook_url) {
    links.push(
      `<a href="${escapeHtml(values.facebook_url)}" target="_blank" rel="noopener noreferrer">Facebook</a>`
    );
  }
  if (values.tiktok_url) {
    links.push(
      `<a href="${escapeHtml(values.tiktok_url)}" target="_blank" rel="noopener noreferrer">TikTok</a>`
    );
  }
  return links.join('');
}

function buildWhatsappUrl(values) {
  const digits = String(values.whatsapp || '').replace(/\D/g, '');
  if (!digits) return '';
  const message = encodeURIComponent(values.whatsapp_message || 'Hola, quiero reservar una cita.');
  return `https://wa.me/${digits}?text=${message}`;
}

function buildMapHtml(values) {
  if (!values.map_embed_url) {
    return '<div class="map-placeholder">Agrega la URL del mapa desde el panel de administración.</div>';
  }
  return `<iframe src="${escapeHtml(values.map_embed_url)}"
    title="Mapa de ${escapeHtml(values.business_name)}"
    loading="lazy" referrerpolicy="no-referrer-when-downgrade"
    allowfullscreen></iframe>`;
}

function buildJsonLd(values, services, barbers) {
  const address = {
    '@type': 'PostalAddress',
    streetAddress: values.address,
    addressLocality: values.address_locality,
    addressRegion: values.address_region,
    addressCountry: values.address_country
  };
  const openingHoursSpecification = [];
  const hours = JSON.parse(values.business_hours);
  for (const item of hours) {
    if (item.closed) continue;
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    openingHoursSpecification.push({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: days[Number(item.weekday)],
      opens: item.start,
      closes: item.end
    });
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'HairSalon',
    name: values.business_name,
    description: values.seo_description,
    url: values.site_url,
    image: absoluteUrl(values.site_url, values.og_image_url),
    telephone: values.phone,
    email: values.email,
    priceRange: values.price_range,
    address,
    openingHoursSpecification,
    employee: barbers.map((barber) => ({
      '@type': 'Person',
      name: barber.name
    })),
    makesOffer: services.map((service) => ({
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Service',
        name: service.name,
        description: service.description
      },
      price: service.price,
      priceCurrency: values.currency
    }))
  };
}

const landing = asyncHandler(async (req, res) => {
  const settings = await getPublicSettings();
  const services = await getPublicServices();
  const barbers = await getPublicBarbers();
  const values = settings.values;
  const themeStyle = `:root{
    --color-primary:${values.color_primary};
    --color-secondary:${values.color_secondary};
    --color-accent:${values.color_accent};
    --color-background:${values.color_background};
    --color-surface:${values.color_surface};
    --color-text:${values.color_text};
    --color-muted:${values.color_muted};
    --font-heading:${values.font_heading};
    --font-body:${values.font_body};
  }`;
  const minPrice = services.length > 0
    ? Math.min(...services.map((service) => Number(service.price)))
    : 0;

  const html = renderTemplate(readView('landing.html'), {
    business_name: values.business_name,
    business_short_name: values.business_short_name,
    tagline: values.tagline,
    hero_title: values.hero_title,
    hero_subtitle: values.hero_subtitle,
    hero_cta: values.hero_cta,
    about_title: values.about_title,
    about_text: escapeHtml(values.about_text).replace(/\n/g, '<br>'),
    services_title: values.services_title,
    services_subtitle: values.services_subtitle,
    team_title: values.team_title,
    team_subtitle: values.team_subtitle,
    gallery_title: values.gallery_title,
    gallery_subtitle: values.gallery_subtitle,
    hours_title: values.hours_title,
    hours_subtitle: values.hours_subtitle,
    location_title: values.location_title,
    location_subtitle: values.location_subtitle,
    contact_title: values.contact_title,
    contact_subtitle: values.contact_subtitle,
    footer_text: values.footer_text,
    seo_title: values.seo_title,
    seo_description: values.seo_description,
    site_url: values.site_url,
    og_image_url: absoluteUrl(values.site_url, values.og_image_url),
    address: values.address,
    address_full: [values.address, values.address_locality, values.address_region]
      .filter(Boolean)
      .join(', '),
    phone: values.phone,
    phone_href: `tel:${String(values.phone || '').replace(/[^\d+]/g, '')}`,
    email: values.email,
    email_href: `mailto:${values.email}`,
    whatsapp_url: buildWhatsappUrl(values),
    instagram_url: values.instagram_url,
    map_directions_url: values.map_directions_url,
    price_from: formatCurrency(minPrice),
    services_count: services.length,
    barbers_count: barbers.length,
    year: new Date().getFullYear(),
    nonce: res.locals.cspNonce || '',
    themeStyle,
    servicesHtml: buildServicesHtml(services),
    barbersHtml: buildBarbersHtml(barbers),
    galleryHtml: buildGalleryHtml(settings.galleryImages),
    hoursHtml: buildHoursHtml(settings.hoursDisplay),
    socialHtml: buildSocialHtml(values),
    mapHtml: buildMapHtml(values),
    jsonLd: safeJsonForHtml(buildJsonLd(values, services, barbers))
  });

  res.type('html').send(html);
});

const booking = (req, res) => {
  res.sendFile(path.join(publicDir, 'reservar.html'));
};

const lookup = (req, res) => {
  res.sendFile(path.join(publicDir, 'consulta.html'));
};

const login = (req, res) => {
  if (req.user) return res.redirect('/admin');
  const csrfToken = issueCsrfToken(req, res);
  const next = sanitizeNext(req.query.next);
  const html = renderTemplate(readView('admin-login.html'), {
    csrfToken,
    next,
    year: new Date().getFullYear()
  });
  res.set('Cache-Control', 'no-store');
  return res.type('html').send(html);
};

const admin = (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(publicDir, 'admin.html'));
};

module.exports = {
  landing,
  booking,
  lookup,
  login,
  admin
};

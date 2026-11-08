const { all, one, withTransaction } = require('../db/pool');
const { badRequest } = require('../utils/errors');
const { dayName, timeToMinutes } = require('../utils/datetime');

const FONT_OPTIONS = [
  "Georgia, 'Times New Roman', serif",
  "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
  "'Trebuchet MS', 'Segoe UI', sans-serif",
  "'Arial Narrow', Impact, sans-serif",
  "'Courier New', monospace"
];

const DEFAULT_SETTINGS = {
  business_name: 'Barbería Don Filo',
  business_short_name: 'Don Filo',
  business_code_prefix: 'DF',
  tagline: 'Cortes con carácter, estilo de barrio',
  hero_title: 'Tu mejor versión empieza con un buen corte',
  hero_subtitle:
    'Tradición, precisión y estilo en el corazón de Bogotá. Reserva online las 24 horas y llega directo a tu silla.',
  hero_cta: 'Reservar cita',
  about_title: 'Más que un corte, una experiencia',
  about_text:
    'En Don Filo cuidamos cada detalle: el filo de la navaja, la conversación, el aroma del after shave y ese rato en el que solo te tienes que preocupar por verte bien.',
  services_title: 'Servicios',
  services_subtitle:
    'Elige el servicio, nosotros ponemos el oficio. Precios claros y tiempos reales.',
  team_title: 'Nuestro equipo',
  team_subtitle: 'Barberos que dominan el oficio y conocen tu estilo.',
  gallery_title: 'Galería',
  gallery_subtitle: 'Algunos trabajos que salen de nuestras sillas.',
  hours_title: 'Horarios de atención',
  hours_subtitle: 'Reserva online 24/7. La confirmación llega al instante.',
  location_title: 'Ubicación',
  location_subtitle:
    'Estamos en el corazón de Bogotá. Llega fácil y reserva sin filas.',
  contact_title: 'Contacto',
  contact_subtitle: 'Escríbenos por WhatsApp o síguenos en redes.',
  footer_text: 'Barbería Don Filo. Hecho con oficio en Bogotá.',
  address: 'Cra 10 # 20-30, Local 2, Bogotá',
  address_locality: 'Bogotá',
  address_region: 'Bogotá D.C.',
  address_country: 'CO',
  phone: '+57 300 000 0000',
  whatsapp: '573000000000',
  email: 'hola@barberiadonfilo.com',
  instagram_url: 'https://www.instagram.com/',
  facebook_url: '',
  tiktok_url: '',
  map_embed_url:
    'https://www.google.com/maps?q=Cra+10+%23+20-30,+Bogot%C3%A1,+Colombia&output=embed',
  map_directions_url:
    'https://www.google.com/maps/dir/?api=1&destination=Cra+10+%23+20-30,+Bogot%C3%A1,+Colombia',
  whatsapp_message: 'Hola, quiero reservar una cita en Barbería Don Filo.',
  site_url: 'http://localhost:3000',
  seo_title: 'Barbería Don Filo | Reserva tu cita en Bogotá',
  seo_description:
    'Cortes clásicos, barba, cejas y tratamientos capilares en Bogotá. Reserva online en Barbería Don Filo y elige a tu barbero.',
  og_image_url: '/img/og-image.svg',
  price_range: '$$',
  currency: 'COP',
  color_primary: '#141414',
  color_secondary: '#c9a227',
  color_accent: '#f3ead7',
  color_background: '#0f0f0f',
  color_surface: '#1f1f1f',
  color_text: '#f5f2ec',
  color_muted: '#b9b3a7',
  font_heading: "Georgia, 'Times New Roman', serif",
  font_body:
    "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
  business_hours: JSON.stringify([
    { weekday: 0, closed: true, start: '09:00', end: '19:00' },
    { weekday: 1, closed: false, start: '09:00', end: '19:00' },
    { weekday: 2, closed: false, start: '09:00', end: '19:00' },
    { weekday: 3, closed: false, start: '09:00', end: '19:00' },
    { weekday: 4, closed: false, start: '09:00', end: '19:00' },
    { weekday: 5, closed: false, start: '09:00', end: '19:00' },
    { weekday: 6, closed: false, start: '09:00', end: '19:00' }
  ]),
  gallery_images: JSON.stringify([
    { src: '/img/gallery-1.svg', alt: 'Corte clásico con degradado' },
    { src: '/img/gallery-2.svg', alt: 'Perfilado de barba' },
    { src: '/img/gallery-3.svg', alt: 'Corte texturizado' },
    { src: '/img/gallery-4.svg', alt: 'Detalle de barba y navaja' },
    { src: '/img/gallery-5.svg', alt: 'Estilo clásico con raya' },
    { src: '/img/gallery-6.svg', alt: 'Acabado con cera mate' }
  ]),
  payment_cash_enabled: '1',
  payment_transfer_enabled: '1',
  payment_cash_label: 'Pagar en el local',
  payment_transfer_label: 'Transferencia (Nequi / Daviplata / Bancolombia)',
  transfer_bank_name: 'Bancolombia',
  transfer_account_type: 'Ahorros',
  transfer_account_number: '000 000 000 00',
  transfer_account_holder: 'Barbería Don Filo',
  transfer_nequi: '300 000 0000',
  transfer_daviplata: '300 000 0000',
  transfer_instructions:
    'Realiza la transferencia y envía el comprobante por WhatsApp indicando tu código de reserva.',
  payment_note:
    'En esta versión el pago se confirma manualmente en el local o por transferencia.',
  slot_interval_minutes: '30',
  min_advance_minutes: '60',
  max_advance_days: '30',
  cancel_min_hours: '2',
  booking_success_message:
    'Tu cita quedó confirmada. Guarda tu código para consultarla o cancelarla.',
  booking_terms:
    'Puedes cancelar sin costo hasta 2 horas antes de la cita. Si no puedes asistir, avísanos por WhatsApp.'
};

const DEFINITIONS = [
  { key: 'business_name', group: 'business', label: 'Nombre del negocio', type: 'text', maxLength: 100 },
  { key: 'business_short_name', group: 'business', label: 'Nombre corto', type: 'text', maxLength: 60 },
  { key: 'business_code_prefix', group: 'business', label: 'Prefijo de códigos', type: 'text', maxLength: 4, help: 'Ejemplo: DF. Se usa en códigos como DF-8K3M2.' },
  { key: 'tagline', group: 'business', label: 'Eslogan', type: 'text', maxLength: 160 },
  { key: 'hero_title', group: 'texts', label: 'Título principal (hero)', type: 'text', maxLength: 120 },
  { key: 'hero_subtitle', group: 'texts', label: 'Subtítulo del hero', type: 'textarea', maxLength: 400 },
  { key: 'hero_cta', group: 'texts', label: 'Texto del botón principal', type: 'text', maxLength: 40 },
  { key: 'about_title', group: 'texts', label: 'Título de la sección "Nosotros"', type: 'text', maxLength: 120 },
  { key: 'about_text', group: 'texts', label: 'Texto de la sección "Nosotros"', type: 'textarea', maxLength: 1200 },
  { key: 'services_title', group: 'texts', label: 'Título de servicios', type: 'text', maxLength: 80 },
  { key: 'services_subtitle', group: 'texts', label: 'Subtítulo de servicios', type: 'textarea', maxLength: 300 },
  { key: 'team_title', group: 'texts', label: 'Título del equipo', type: 'text', maxLength: 80 },
  { key: 'team_subtitle', group: 'texts', label: 'Subtítulo del equipo', type: 'textarea', maxLength: 300 },
  { key: 'gallery_title', group: 'texts', label: 'Título de galería', type: 'text', maxLength: 80 },
  { key: 'gallery_subtitle', group: 'texts', label: 'Subtítulo de galería', type: 'textarea', maxLength: 300 },
  { key: 'hours_title', group: 'texts', label: 'Título de horarios', type: 'text', maxLength: 80 },
  { key: 'hours_subtitle', group: 'texts', label: 'Subtítulo de horarios', type: 'textarea', maxLength: 300 },
  { key: 'location_title', group: 'texts', label: 'Título de ubicación', type: 'text', maxLength: 80 },
  { key: 'location_subtitle', group: 'texts', label: 'Subtítulo de ubicación', type: 'textarea', maxLength: 300 },
  { key: 'contact_title', group: 'texts', label: 'Título de contacto', type: 'text', maxLength: 80 },
  { key: 'contact_subtitle', group: 'texts', label: 'Subtítulo de contacto', type: 'textarea', maxLength: 300 },
  { key: 'footer_text', group: 'texts', label: 'Texto del footer', type: 'text', maxLength: 200 },
  { key: 'address', group: 'location', label: 'Dirección', type: 'text', maxLength: 200 },
  { key: 'address_locality', group: 'location', label: 'Ciudad', type: 'text', maxLength: 100 },
  { key: 'address_region', group: 'location', label: 'Departamento / región', type: 'text', maxLength: 100 },
  { key: 'address_country', group: 'location', label: 'País (ISO 2)', type: 'text', maxLength: 2 },
  { key: 'phone', group: 'contact', label: 'Teléfono visible', type: 'text', maxLength: 40 },
  { key: 'whatsapp', group: 'contact', label: 'WhatsApp (con indicativo, solo números)', type: 'text', maxLength: 20, help: 'Ejemplo: 573000000000.' },
  { key: 'email', group: 'contact', label: 'Email de contacto', type: 'email', maxLength: 150 },
  { key: 'instagram_url', group: 'contact', label: 'Instagram (URL)', type: 'url', maxLength: 300 },
  { key: 'facebook_url', group: 'contact', label: 'Facebook (URL)', type: 'url', maxLength: 300 },
  { key: 'tiktok_url', group: 'contact', label: 'TikTok (URL)', type: 'url', maxLength: 300 },
  { key: 'whatsapp_message', group: 'contact', label: 'Mensaje prellenado de WhatsApp', type: 'textarea', maxLength: 300 },
  { key: 'map_embed_url', group: 'location', label: 'URL embebible de Google Maps', type: 'map_url', maxLength: 1000 },
  { key: 'map_directions_url', group: 'location', label: 'URL de "Cómo llegar"', type: 'map_url', maxLength: 1000 },
  { key: 'site_url', group: 'seo', label: 'URL pública del sitio', type: 'url', maxLength: 300 },
  { key: 'seo_title', group: 'seo', label: 'Título SEO', type: 'text', maxLength: 120 },
  { key: 'seo_description', group: 'seo', label: 'Meta description', type: 'textarea', maxLength: 300 },
  { key: 'og_image_url', group: 'seo', label: 'Imagen Open Graph', type: 'image_url', maxLength: 500 },
  { key: 'price_range', group: 'seo', label: 'Rango de precios', type: 'text', maxLength: 10 },
  { key: 'currency', group: 'business', label: 'Moneda (ISO 3)', type: 'text', maxLength: 3 },
  { key: 'color_primary', group: 'design', label: 'Color primario', type: 'color' },
  { key: 'color_secondary', group: 'design', label: 'Color secundario', type: 'color' },
  { key: 'color_accent', group: 'design', label: 'Color de acento', type: 'color' },
  { key: 'color_background', group: 'design', label: 'Color de fondo', type: 'color' },
  { key: 'color_surface', group: 'design', label: 'Color de superficies', type: 'color' },
  { key: 'color_text', group: 'design', label: 'Color de texto', type: 'color' },
  { key: 'color_muted', group: 'design', label: 'Color de texto secundario', type: 'color' },
  { key: 'font_heading', group: 'design', label: 'Tipografía de títulos', type: 'select', options: FONT_OPTIONS },
  { key: 'font_body', group: 'design', label: 'Tipografía de texto', type: 'select', options: FONT_OPTIONS },
  { key: 'business_hours', group: 'hours', label: 'Horario general del negocio', type: 'hours' },
  { key: 'gallery_images', group: 'design', label: 'Imágenes de la galería', type: 'gallery' },
  { key: 'payment_cash_enabled', group: 'payments', label: 'Permitir pago en el local', type: 'boolean' },
  { key: 'payment_transfer_enabled', group: 'payments', label: 'Permitir transferencia', type: 'boolean' },
  { key: 'payment_cash_label', group: 'payments', label: 'Etiqueta de pago en local', type: 'text', maxLength: 80 },
  { key: 'payment_transfer_label', group: 'payments', label: 'Etiqueta de transferencia', type: 'text', maxLength: 100 },
  { key: 'transfer_bank_name', group: 'payments', label: 'Banco', type: 'text', maxLength: 100 },
  { key: 'transfer_account_type', group: 'payments', label: 'Tipo de cuenta', type: 'text', maxLength: 50 },
  { key: 'transfer_account_number', group: 'payments', label: 'Número de cuenta', type: 'text', maxLength: 80 },
  { key: 'transfer_account_holder', group: 'payments', label: 'Titular de la cuenta', type: 'text', maxLength: 120 },
  { key: 'transfer_nequi', group: 'payments', label: 'Nequi', type: 'text', maxLength: 40 },
  { key: 'transfer_daviplata', group: 'payments', label: 'Daviplata', type: 'text', maxLength: 40 },
  { key: 'transfer_instructions', group: 'payments', label: 'Instrucciones de transferencia', type: 'textarea', maxLength: 600 },
  { key: 'payment_note', group: 'payments', label: 'Nota de pagos', type: 'textarea', maxLength: 300 },
  { key: 'slot_interval_minutes', group: 'rules', label: 'Intervalo de slots (minutos)', type: 'number', min: 15, max: 120 },
  { key: 'min_advance_minutes', group: 'rules', label: 'Anticipación mínima para reservar (minutos)', type: 'number', min: 0, max: 1440 },
  { key: 'max_advance_days', group: 'rules', label: 'Días máximos hacia adelante', type: 'number', min: 1, max: 365 },
  { key: 'cancel_min_hours', group: 'rules', label: 'Horas mínimas para cancelar', type: 'number', min: 0, max: 168 },
  { key: 'booking_success_message', group: 'texts', label: 'Mensaje de reserva exitosa', type: 'textarea', maxLength: 400 },
  { key: 'booking_terms', group: 'rules', label: 'Texto de condiciones de reserva', type: 'textarea', maxLength: 600 }
];

const DEFINITIONS_BY_KEY = new Map(DEFINITIONS.map((definition) => [definition.key, definition]));
const JSON_KEYS = new Set(['business_hours', 'gallery_images']);

function definitionFor(key) {
  return DEFINITIONS_BY_KEY.get(key) || null;
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (error) {
    return false;
  }
}

function isMapUrl(value) {
  if (!isHttpUrl(value)) return false;
  const host = new URL(value).hostname.toLowerCase();
  return (
    host === 'google.com' ||
    host.endsWith('.google.com') ||
    host === 'google.com.co' ||
    host.endsWith('.google.com.co') ||
    host === 'maps.google.com'
  );
}

function isImageUrl(value) {
  return value.startsWith('/') || isHttpUrl(value);
}

function validateBusinessHours(value) {
  let hours = value;
  if (typeof hours === 'string') hours = parseJson(hours, null);
  if (!Array.isArray(hours) || hours.length !== 7) {
    throw badRequest('El horario general debe tener los 7 días de la semana.');
  }
  const normalized = [];
  for (let weekday = 0; weekday < 7; weekday += 1) {
    const item = hours.find((entry) => Number(entry.weekday) === weekday) || {};
    const closed = Boolean(item.closed);
    const start = String(item.start || '09:00').slice(0, 5);
    const end = String(item.end || '19:00').slice(0, 5);
    if (!closed) {
      const startMinutes = timeToMinutes(start);
      const endMinutes = timeToMinutes(end);
      if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
        throw badRequest(`El horario del ${dayName(weekday)} no es válido.`);
      }
    }
    normalized.push({ weekday, closed, start, end });
  }
  return normalized;
}

function validateGallery(value) {
  let images = value;
  if (typeof images === 'string') images = parseJson(images, null);
  if (!Array.isArray(images) || images.length === 0 || images.length > 12) {
    throw badRequest('La galería debe tener entre 1 y 12 imágenes.');
  }
  return images.map((image) => {
    const src = String(image.src || '').trim();
    const alt = String(image.alt || '').trim();
    if (!src || !isImageUrl(src)) {
      throw badRequest('Cada imagen de la galería debe tener una ruta o URL válida.');
    }
    if (!alt || alt.length > 200) {
      throw badRequest('Cada imagen de la galería debe tener un texto alternativo de máximo 200 caracteres.');
    }
    return { src, alt };
  });
}

function normalizeValue(key, value) {
  const definition = definitionFor(key);
  if (!definition) {
    throw badRequest(`La configuración "${key}" no existe.`);
  }

  if (key === 'business_hours') {
    return JSON.stringify(validateBusinessHours(value));
  }
  if (key === 'gallery_images') {
    return JSON.stringify(validateGallery(value));
  }

  if (definition.type === 'boolean') {
    const truthy = value === true || value === '1' || value === 1 || value === 'true';
    return truthy ? '1' : '0';
  }

  if (value === null || value === undefined) {
    return '';
  }

  const text = String(value).trim();

  if (definition.type === 'number') {
    const number = Number.parseInt(text, 10);
    if (!Number.isInteger(number)) {
      throw badRequest(`${definition.label} debe ser un número entero.`);
    }
    if (definition.min !== undefined && number < definition.min) {
      throw badRequest(`${definition.label} debe ser mayor o igual a ${definition.min}.`);
    }
    if (definition.max !== undefined && number > definition.max) {
      throw badRequest(`${definition.label} debe ser menor o igual a ${definition.max}.`);
    }
    return String(number);
  }

  if (definition.type === 'color') {
    if (!/^#[0-9a-fA-F]{6}$/.test(text)) {
      throw badRequest(`${definition.label} debe ser un color hexadecimal como #c9a227.`);
    }
    return text.toLowerCase();
  }

  if (definition.type === 'email') {
    if (text && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
      throw badRequest(`${definition.label} no es un email válido.`);
    }
    return text;
  }

  if (definition.type === 'url' || definition.type === 'image_url') {
    if (text && !(definition.type === 'image_url' ? isImageUrl(text) : isHttpUrl(text))) {
      throw badRequest(`${definition.label} debe ser una URL válida.`);
    }
    return text;
  }

  if (definition.type === 'map_url') {
    if (text && !isMapUrl(text)) {
      throw badRequest(`${definition.label} debe ser una URL de Google Maps.`);
    }
    return text;
  }

  if (definition.type === 'select') {
    if (!definition.options.includes(text)) {
      throw badRequest(`${definition.label} no tiene una opción válida.`);
    }
    return text;
  }

  if (definition.maxLength && text.length > definition.maxLength) {
    throw badRequest(`${definition.label} no puede superar ${definition.maxLength} caracteres.`);
  }

  if (key === 'business_code_prefix' && !/^[A-Z]{2,4}$/.test(text.toUpperCase())) {
    throw badRequest('El prefijo de códigos debe tener entre 2 y 4 letras.');
  }
  if (key === 'currency' && !/^[A-Z]{3}$/.test(text.toUpperCase())) {
    throw badRequest('La moneda debe tener 3 letras, por ejemplo COP.');
  }
  if (key === 'address_country' && !/^[A-Z]{2}$/.test(text.toUpperCase())) {
    throw badRequest('El país debe tener 2 letras, por ejemplo CO.');
  }
  if (key === 'whatsapp' && text && !/^\d{10,15}$/.test(text)) {
    throw badRequest('El WhatsApp debe tener solo números e incluir el indicativo.');
  }

  if (key === 'business_code_prefix' || key === 'currency' || key === 'address_country') {
    return text.toUpperCase();
  }

  return text;
}

async function getAllSettings(executor) {
  const rows = await all('SELECT setting_key, setting_value FROM settings', [], executor);
  const values = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    values[row.setting_key] = row.setting_value;
  }
  return values;
}

async function getSetting(key, executor) {
  const row = await one(
    'SELECT setting_value FROM settings WHERE setting_key = ? LIMIT 1',
    [key],
    executor
  );
  return row ? row.setting_value : DEFAULT_SETTINGS[key] ?? '';
}

function buildRules(values) {
  return {
    slotIntervalMinutes: Number.parseInt(values.slot_interval_minutes, 10) || 30,
    minAdvanceMinutes: Number.parseInt(values.min_advance_minutes, 10) || 0,
    maxAdvanceDays: Number.parseInt(values.max_advance_days, 10) || 30,
    cancelMinHours: Number.parseInt(values.cancel_min_hours, 10) || 0
  };
}

function buildHoursDisplay(values) {
  const hours = validateBusinessHours(values.business_hours);
  return hours.map((item) => ({
    ...item,
    day: dayName(item.weekday)
  }));
}

function buildPaymentMethods(values) {
  const methods = [];
  if (values.payment_cash_enabled === '1') {
    methods.push({
      value: 'cash_on_site',
      label: values.payment_cash_label || 'Pagar en el local'
    });
  }
  if (values.payment_transfer_enabled === '1') {
    methods.push({
      value: 'bank_transfer',
      label: values.payment_transfer_label || 'Transferencia'
    });
  }
  return methods;
}

function buildTransferData(values) {
  return {
    bankName: values.transfer_bank_name,
    accountType: values.transfer_account_type,
    accountNumber: values.transfer_account_number,
    accountHolder: values.transfer_account_holder,
    nequi: values.transfer_nequi,
    daviplata: values.transfer_daviplata,
    instructions: values.transfer_instructions
  };
}

async function getPublicSettings(executor) {
  const values = await getAllSettings(executor);
  const businessHours = validateBusinessHours(values.business_hours);
  const galleryImages = validateGallery(values.gallery_images);
  return {
    values,
    businessHours,
    hoursDisplay: buildHoursDisplay(values),
    galleryImages,
    rules: buildRules(values),
    paymentMethods: buildPaymentMethods(values),
    transfer: buildTransferData(values)
  };
}

async function getAdminSettings() {
  const values = await getAllSettings();
  return {
    values,
    definitions: DEFINITIONS,
    parsed: {
      business_hours: validateBusinessHours(values.business_hours),
      gallery_images: validateGallery(values.gallery_images),
      rules: buildRules(values),
      paymentMethods: buildPaymentMethods(values),
      transfer: buildTransferData(values)
    }
  };
}

async function updateSettings(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw badRequest('La configuración enviada no es válida.');
  }

  const normalized = {};
  for (const [key, value] of Object.entries(input)) {
    normalized[key] = normalizeValue(key, value);
  }

  return withTransaction(async (connection) => {
    const current = await getAllSettings(connection);
    const merged = { ...current, ...normalized };
    if (merged.payment_cash_enabled !== '1' && merged.payment_transfer_enabled !== '1') {
      throw badRequest('Debe quedar habilitado al menos un método de pago.');
    }

    for (const [key, value] of Object.entries(normalized)) {
      await connection.execute(
        `INSERT INTO settings (setting_key, setting_value)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [key, value]
      );
    }

    return getAllSettings(connection);
  });
}

async function getRules(executor) {
  return buildRules(await getAllSettings(executor));
}

async function getBusinessHours(executor) {
  return validateBusinessHours((await getAllSettings(executor)).business_hours);
}

module.exports = {
  FONT_OPTIONS,
  DEFAULT_SETTINGS,
  DEFINITIONS,
  JSON_KEYS,
  definitionFor,
  normalizeValue,
  validateBusinessHours,
  validateGallery,
  getAllSettings,
  getSetting,
  getPublicSettings,
  getAdminSettings,
  updateSettings,
  getRules,
  getBusinessHours,
  buildRules,
  buildPaymentMethods,
  buildTransferData
};

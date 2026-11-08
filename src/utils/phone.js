function normalizePhone(input) {
  if (input === null || input === undefined) return null;
  let value = String(input).trim().replace(/[\s\-().]/g, '');
  if (value.startsWith('+57')) {
    value = value.slice(3);
  } else if (value.startsWith('57') && value.length === 12) {
    value = value.slice(2);
  }
  if (!/^\d{10}$/.test(value)) return null;
  return value;
}

function isValidPhone(input) {
  return normalizePhone(input) !== null;
}

function formatPhone(input) {
  const normalized = normalizePhone(input);
  if (!normalized) return '';
  return `+57 ${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6)}`;
}

function whatsappDigits(input) {
  const normalized = normalizePhone(input);
  if (normalized) return `57${normalized}`;
  return String(input || '').replace(/\D/g, '');
}

module.exports = {
  normalizePhone,
  isValidPhone,
  formatPhone,
  whatsappDigits
};

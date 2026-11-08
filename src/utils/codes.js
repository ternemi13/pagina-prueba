const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function sanitizePrefix(prefix, fallback = 'DF') {
  const clean = String(prefix || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4);
  return clean || fallback;
}

function generateCode(prefix = 'DF') {
  let suffix = '';
  for (let i = 0; i < 5; i += 1) {
    suffix += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  }
  return `${sanitizePrefix(prefix)}-${suffix}`;
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

module.exports = {
  ALPHABET,
  sanitizePrefix,
  generateCode,
  randomToken
};

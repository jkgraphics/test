import crypto from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
export const bad = (msg, extra) => new HttpError(400, msg, extra);
export const forbidden = (msg = 'You do not have permission to do that') => new HttpError(403, msg);
// Records in other companies are reported as "not found" so their existence is not leaked.
export const notFound = (what = 'Record') => new HttpError(404, `${what} not found`);
export const conflict = (msg, extra) => new HttpError(409, msg, extra);

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
export const hmacHex = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');
export function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
export const randomDigits = (n) => Array.from({ length: n }, () => crypto.randomInt(0, 10)).join('');

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}
export function verifyPassword(pw, stored) {
  const [alg, salt, key] = String(stored).split('$');
  if (alg !== 'scrypt' || !salt || !key) return false;
  const derived = crypto.scryptSync(pw, Buffer.from(salt, 'base64'), 64, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(key, 'base64');
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

// AES-256-GCM for secrets stored in the database (e.g. a restaurant's gateway API secret).
export function makeCipher(keyMaterial) {
  const key = crypto.createHash('sha256').update(keyMaterial).digest();
  return {
    encrypt(plain) {
      if (!plain) return '';
      const iv = crypto.randomBytes(12);
      const c = crypto.createCipheriv('aes-256-gcm', key, iv);
      const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
      return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
    },
    decrypt(blob) {
      if (!blob) return '';
      const [v, iv, tag, data] = blob.split(':');
      if (v !== 'v1') throw new Error('Unknown secret format');
      const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
      d.setAuthTag(Buffer.from(tag, 'base64'));
      return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
    },
  };
}

export const json = (s, fallback) => {
  if (s == null || s === '') return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
};

export const nowIso = () => new Date().toISOString();

export function slugify(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim()
    .replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'restaurant';
}

// --- input validation helpers -------------------------------------------------------------
export function str(v, name, { min = 0, max = 200, required = false } = {}) {
  if (v == null || v === '') {
    if (required) throw bad(`${name} is required`);
    return '';
  }
  if (typeof v !== 'string' && typeof v !== 'number') throw bad(`${name} must be text`);
  const s = String(v).trim();
  if (required && !s) throw bad(`${name} is required`);
  if (s.length < min) throw bad(`${name} must be at least ${min} characters`);
  if (s.length > max) throw bad(`${name} must be at most ${max} characters`);
  return s;
}
export function int(v, name, { min = -Infinity, max = Infinity, required = false, fallback = null } = {}) {
  if (v == null || v === '') {
    if (required) throw bad(`${name} is required`);
    return fallback;
  }
  const n = Number(v);
  if (!Number.isInteger(n)) throw bad(`${name} must be a whole number`);
  if (n < min || n > max) throw bad(`${name} must be between ${min} and ${max}`);
  return n;
}
export function num(v, name, { min = -Infinity, max = Infinity, required = false, fallback = null } = {}) {
  if (v == null || v === '') {
    if (required) throw bad(`${name} is required`);
    return fallback;
  }
  const n = Number(v);
  if (!Number.isFinite(n)) throw bad(`${name} must be a number`);
  if (n < min || n > max) throw bad(`${name} must be between ${min} and ${max}`);
  return n;
}
export function oneOf(v, name, allowed, { required = true, fallback } = {}) {
  if (v == null || v === '') {
    if (required && fallback === undefined) throw bad(`${name} is required`);
    return fallback;
  }
  if (!allowed.includes(v)) throw bad(`${name} must be one of: ${allowed.join(', ')}`);
  return v;
}
export const bool = (v) => v === true || v === 1 || v === '1' || v === 'true' || v === 'on';
export function email(v, name = 'Email') {
  const s = str(v, name, { required: true, max: 160 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw bad(`${name} is not a valid email address`);
  return s;
}

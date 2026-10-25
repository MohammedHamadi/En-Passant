export const ADMIN_SESSION_COOKIE = 'admin_session';
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
export const normalizeEmail = email => email.trim().toLowerCase();
export function roleForEmail(email) {
  const normalized = normalizeEmail(email),
    list = name => (process.env[name] ?? '').split(',').map(normalizeEmail).filter(Boolean);
  if ([...list('ADMIN_EMAILS'), ...list('ALLOWED_ADMIN_EMAILS')].includes(normalized)) return 'admin';
  if (list('ARBITER_EMAILS').includes(normalized)) return 'arbiter';
  return null;
}
export const isAllowedAdminEmail = email => Boolean(roleForEmail(email));
export function sessionSecret() {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error(
    'ADMIN_SESSION_SECRET must contain at least 32 characters.');
  return value;
}
const encode = bytes => Buffer.from(bytes).toString('base64url');
async function key() {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(sessionSecret()), {
    name: 'HMAC',
    hash: 'SHA-256'
  }, false, ['sign', 'verify']);
}
export async function createAdminSessionToken(email) {
  const role = roleForEmail(email);
  if (!role) throw new Error('Unauthorized email.');
  const payload = encode(JSON.stringify({
    email: normalizeEmail(email),
    role,
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SECONDS
  }));
  const signature = await crypto.subtle.sign('HMAC', await key(), new TextEncoder().encode(payload));
  return `${payload}.${encode(signature)}`;
}
export async function verifyAdminSessionToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, signature] = parts;
    if (!await crypto.subtle.verify('HMAC', await key(), Buffer.from(signature, 'base64url'),
        new TextEncoder().encode(payload))) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!['admin', 'arbiter'].includes(data.role) || typeof data.email !== 'string' || !Number.isFinite(data
        .exp) || data.exp <= Date.now() / 1000 ||
      data.role !== roleForEmail(data.email)) return null;
    return data;
  } catch {
    return null;
  }
}

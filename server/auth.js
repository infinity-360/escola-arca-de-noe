import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { q } from './db.js';

export const COOKIE = 'arca_sid';
const SESSION_DAYS = 7;
const IS_PROD = process.env.NODE_ENV === 'production';

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = () => crypto.randomBytes(32).toString('hex');

export const hashPassword = (p) => bcrypt.hash(p, 11);
export const checkPassword = (p, h) => bcrypt.compare(p, h);

// ---------- Validações ----------
export function normalizeEmail(e) {
  return String(e || '').trim().toLowerCase();
}
export function isEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 160;
}
/** Normaliza WhatsApp brasileiro para 55 + DDD + número (somente dígitos). */
export function normalizeWhatsApp(w) {
  let d = String(w || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return d;
}
export function isWhatsApp(d) {
  return /^55\d{10,11}$/.test(d);
}
export function passwordProblem(p) {
  p = String(p || '');
  if (p.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
  if (p.length > 128) return 'A senha é muito longa.';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'A senha deve conter letras e números.';
  return null;
}
export function formatWhatsApp(d) {
  const m = String(d || '').match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : d;
}

// ---------- Sessões ----------
export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function createSession(res, userId) {
  const token = randomToken();
  const expires = Date.now() + SESSION_DAYS * 864e5;
  q.run('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)', sha256(token), userId, expires);
  q.run("UPDATE users SET last_login_at = datetime('now') WHERE id = ?", userId);
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${IS_PROD ? '; Secure' : ''}`);
}

export function destroySession(req, res) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) q.run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${IS_PROD ? '; Secure' : ''}`);
}

/** Carrega req.user a partir do cookie (se houver). */
export function loadUser(req, _res, next) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) {
    const row = q.get(
      `SELECT u.id, u.role, u.name, u.email, u.whatsapp, u.active, u.notify_email, u.notify_whatsapp
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ?`, sha256(token), Date.now());
    if (row && row.active) req.user = row;
  }
  next();
}

export const STAFF = ['professor', 'diretor'];

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Faça login para continuar.' });
    if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: 'Acesso não permitido para o seu perfil.' });
    next();
  };
}

// ---------- Limite de tentativas (login, cadastro, recuperação) ----------
const buckets = new Map();
export function rateLimit(name, max, windowMs) {
  return (req, res, next) => {
    const key = `${name}:${req.ip}`;
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || b.reset < now) { b = { n: 0, reset: now + windowMs }; buckets.set(key, b); }
    if (++b.n > max) {
      const min = Math.ceil((b.reset - now) / 60000);
      return res.status(429).json({ error: `Muitas tentativas. Tente novamente em ${min} minuto(s).` });
    }
    next();
  };
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k); }, 600000).unref();

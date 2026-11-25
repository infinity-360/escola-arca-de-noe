// Utilitários compartilhados entre as páginas
import { IS_DEMO, demoApi } from './demo.js';
export { IS_DEMO };
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Escapa e transforma URLs em links clicáveis. */
export function linkify(text) {
  return esc(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
}

export async function api(url, { method = 'GET', body, form } = {}) {
  url = url.replace(/^\//, ''); // caminho relativo: funciona na raiz ou em subpasta
  if (IS_DEMO) return demoApi(url, { method, body, form });
  const opts = { method, headers: { 'X-Requested-With': 'fetch' }, credentials: 'same-origin' };
  if (form) opts.body = form;
  else if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; }
  let res;
  try { res = await fetch(url, opts); }
  catch { throw new Error('Sem conexão com o servidor. Verifique sua internet.'); }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : {};
  if (!res.ok) throw Object.assign(new Error(data.error || 'Algo deu errado. Tente novamente.'), { status: res.status });
  return data;
}

let toastHost;
export function toast(msg, type = '') {
  if (!toastHost) { toastHost = document.createElement('div'); toastHost.className = 'toast-host'; toastHost.setAttribute('role', 'status'); document.body.append(toastHost); }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  toastHost.append(t);
  setTimeout(() => t.remove(), 4200);
}

export const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${day}/${m}/${y}`;
}
export function fmtDateTime(s) {
  if (!s) return '—';
  const dt = new Date(s.replace(' ', 'T') + 'Z');
  return dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
export function weekday(d) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('pt-BR', { weekday: 'long' });
}
export function isPast(d) {
  if (!d) return false;
  const t = new Date(); const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  return d < today;
}
export function fmtSize(b) {
  return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
}

export const TYPE_ICONS = { aviso: '📢', feriado: '🏖️', reuniao: '👥', evento: '🎉', passeio: '🚌', cardapio: '🍎', matricula: '📝', atualizacao: '✨' };

/** Card de publicação do mural (usado no site e na Área dos Pais). */
export function postCard(p, types = {}) {
  const label = types[p.type] || 'Aviso';
  let chip = '';
  if (p.event_date) {
    const [, m, d] = p.event_date.split('-');
    chip = `<div class="date-chip" title="${esc(weekday(p.event_date))}"><b>${d}</b><small>${MONTHS[Number(m) - 1]}</small></div>`;
  }
  const time = p.event_time ? ` · ${esc(p.event_time)}` : '';
  return `<article class="post t-${esc(p.type)} ${p.pinned ? 'pinned' : ''} ${isPast(p.event_date) ? 'past' : ''}">
    ${p.pinned ? '<span class="pin">📌 Destaque</span>' : ''}
    ${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : ''}
    <div class="post-body">
      <div class="post-meta">
        <span class="tag">${TYPE_ICONS[p.type] || '📢'} ${esc(label)}</span>
        ${p.visibility === 'pais' ? '<span class="tag" style="--c:#0E5F86;--cs:#E1F3FB">🔒 Só para pais</span>' : ''}
        ${chip}
      </div>
      <h3>${esc(p.title)}</h3>
      ${p.event_date ? `<small class="muted"><b>${esc(weekday(p.event_date))}, ${fmtDate(p.event_date)}${time}</b></small>` : ''}
      ${p.body ? `<p>${linkify(p.body)}</p>` : ''}
    </div>
  </article>`;
}

/** Máscara de WhatsApp (xx) xxxxx-xxxx */
export function maskPhone(input) {
  input.addEventListener('input', () => {
    let d = input.value.replace(/\D/g, '');
    if (d.startsWith('55') && d.length > 11) d = d.slice(2);
    d = d.slice(0, 11);
    let out = d;
    if (d.length > 2) out = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length > 7) out = `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
    input.value = out;
  });
}
export function phoneFromIntl(d) {
  const m = String(d || '').match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : d || '';
}

export function setupPasswordToggles(root = document) {
  $$('.pw-toggle', root).forEach((b) => {
    if (b.dataset.ready) return;
    b.dataset.ready = 1;
    b.addEventListener('click', () => {
      const i = b.previousElementSibling;
      i.type = i.type === 'password' ? 'text' : 'password';
      b.textContent = i.type === 'password' ? '👁️' : '🙈';
      b.setAttribute('aria-label', i.type === 'password' ? 'Mostrar senha' : 'Ocultar senha');
    });
  });
}

export function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

/** Envia formulário com estado de carregamento e mensagens de erro. */
export async function submitting(form, fn) {
  const btn = form.querySelector('[type=submit]');
  const alertBox = form.querySelector('.form-alert');
  if (alertBox) { alertBox.className = 'form-alert hidden'; alertBox.textContent = ''; }
  const label = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = 'Aguarde…'; }
  try { return await fn(); }
  catch (e) {
    if (alertBox) { alertBox.className = 'form-alert alert alert-error'; alertBox.textContent = e.message; }
    else toast(e.message, 'err');
  } finally { if (btn) { btn.disabled = false; btn.innerHTML = label; } }
}

export function showAlert(form, msg, type = 'ok') {
  const a = form.querySelector('.form-alert');
  if (a) { a.className = `form-alert alert alert-${type}`; a.textContent = msg; }
}

// Modais
export function openModal(id) { const m = document.getElementById(id); m.classList.add('open'); m.querySelector('input,textarea,select,button')?.focus(); }
export function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-close]');
  if (c) c.closest('.modal')?.classList.remove('open');
  if (e.target.classList?.contains('modal')) e.target.classList.remove('open');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') $$('.modal.open').forEach((m) => m.classList.remove('open'));
});

export function confirmDialog(msg) { return window.confirm(msg); }

export const WA_ICON = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 7L3 29l6.4-2c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.8S23.2 3 16 3zm0 23.4c-2.1 0-4.1-.6-5.9-1.7l-.4-.3-3.8 1.2 1.2-3.7-.3-.4c-1.2-1.8-1.9-3.9-1.9-6.1C4.9 9.8 9.9 4.9 16 4.9s11.1 4.9 11.1 10.9-5 10.6-11.1 10.6zm6.1-7.9c-.3-.2-2-1-2.3-1.1-.3-.1-.5-.2-.8.2-.2.3-.9 1.1-1.1 1.3-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.7-1.7-1-.9-1.7-2-1.9-2.3-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.4.3-.6.1-.2 0-.4 0-.6l-1-2.5c-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.6.1-.9.4-.3.3-1.2 1.2-1.2 2.9s1.2 3.4 1.4 3.6c.2.2 2.4 3.7 5.9 5.1 2.9 1.1 3.5.9 4.1.8.6-.1 2-.8 2.3-1.6.3-.8.3-1.5.2-1.6-.1-.1-.3-.2-.6-.4z"/></svg>';

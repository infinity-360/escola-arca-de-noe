// Envio de notificações por e-mail (SMTP) e WhatsApp (Z-API, Evolution API, Meta Cloud API ou webhook).
import nodemailer from 'nodemailer';
import { q, getSettings } from './db.js';

const env = process.env;
export const SITE_URL = () => (env.SITE_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/$/, '');

// ---------- E-mail ----------
let transporter = null;
export function emailConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}
function getTransporter() {
  if (!transporter && emailConfigured()) {
    const port = Number(env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }
  return transporter;
}

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function emailLayout({ title, intro = '', body = '', ctaText, ctaUrl }) {
  const s = getSettings();
  return `<!doctype html><html><body style="margin:0;background:#FFF7EC;font-family:Arial,Helvetica,sans-serif;color:#2D2244">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF7EC;padding:24px 12px"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #F0E4D2">
      <tr><td style="background:#6B3FA0;padding:22px 28px;color:#fff">
        <div style="font-size:22px;font-weight:bold">🌈 ${escapeHtml(s.school_name)}</div>
        <div style="font-size:13px;opacity:.85">${escapeHtml(s.school_subtitle)}</div>
      </td></tr>
      <tr><td style="padding:28px">
        <h1 style="margin:0 0 12px;font-size:21px;color:#6B3FA0">${escapeHtml(title)}</h1>
        ${intro ? `<p style="margin:0 0 14px;font-size:15px;line-height:1.55">${intro}</p>` : ''}
        ${body ? `<div style="font-size:15px;line-height:1.6;white-space:pre-line">${body}</div>` : ''}
        ${ctaUrl ? `<p style="margin:26px 0 6px"><a href="${escapeHtml(ctaUrl)}" style="background:#7CC243;color:#fff;text-decoration:none;padding:13px 24px;border-radius:999px;font-weight:bold;display:inline-block">${escapeHtml(ctaText || 'Acessar')}</a></p>` : ''}
      </td></tr>
      <tr><td style="padding:16px 28px;background:#FBF5EC;font-size:12px;color:#7a6f86">
        Você recebeu esta mensagem porque está cadastrado no portal da ${escapeHtml(s.school_name)}.
        Para deixar de receber, acesse “Meus dados” na sua área e desative as notificações.
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

export async function sendEmail(to, subject, html, text) {
  const t = getTransporter();
  if (!t) {
    console.log(`[e-mail não configurado] Para: ${to} | Assunto: ${subject}\n${text || ''}`);
    return { status: 'nao_configurado' };
  }
  const s = getSettings();
  await t.sendMail({
    from: env.SMTP_FROM || `"${s.school_name}" <${env.SMTP_USER}>`,
    to, subject, html, text,
  });
  return { status: 'enviado' };
}

// ---------- WhatsApp ----------
export function whatsappProvider() {
  const p = (env.WHATSAPP_PROVIDER || '').toLowerCase();
  if (p === 'zapi' && env.ZAPI_INSTANCE_ID && env.ZAPI_TOKEN) return 'zapi';
  if (p === 'evolution' && env.EVOLUTION_URL && env.EVOLUTION_INSTANCE && env.EVOLUTION_APIKEY) return 'evolution';
  if (p === 'meta' && env.META_WA_TOKEN && env.META_WA_PHONE_ID) return 'meta';
  if (p === 'webhook' && env.WHATSAPP_WEBHOOK_URL) return 'webhook';
  return null;
}

async function postJson(url, body, headers = {}) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r;
}

export async function sendWhatsApp(phone, message) {
  const provider = whatsappProvider();
  if (!provider) {
    console.log(`[WhatsApp não configurado] Para: ${phone}\n${message}`);
    return { status: 'nao_configurado' };
  }
  if (provider === 'zapi') {
    await postJson(`https://api.z-api.io/instances/${env.ZAPI_INSTANCE_ID}/token/${env.ZAPI_TOKEN}/send-text`,
      { phone, message }, env.ZAPI_CLIENT_TOKEN ? { 'Client-Token': env.ZAPI_CLIENT_TOKEN } : {});
  } else if (provider === 'evolution') {
    await postJson(`${env.EVOLUTION_URL.replace(/\/$/, '')}/message/sendText/${encodeURIComponent(env.EVOLUTION_INSTANCE)}`,
      { number: phone, text: message }, { apikey: env.EVOLUTION_APIKEY });
  } else if (provider === 'meta') {
    const url = `https://graph.facebook.com/${env.META_WA_VERSION || 'v21.0'}/${env.META_WA_PHONE_ID}/messages`;
    const auth = { Authorization: `Bearer ${env.META_WA_TOKEN}` };
    if (env.META_WA_TEMPLATE) {
      // Modelos aprovados pela Meta são necessários para iniciar conversas.
      await postJson(url, {
        messaging_product: 'whatsapp', to: phone, type: 'template',
        template: {
          name: env.META_WA_TEMPLATE,
          language: { code: env.META_WA_TEMPLATE_LANG || 'pt_BR' },
          components: [{ type: 'body', parameters: [{ type: 'text', text: message.slice(0, 1000).replace(/\n+/g, ' · ') }] }],
        },
      }, auth);
    } else {
      await postJson(url, { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: message } }, auth);
    }
  } else if (provider === 'webhook') {
    await postJson(env.WHATSAPP_WEBHOOK_URL, { phone, message },
      env.WHATSAPP_WEBHOOK_TOKEN ? { Authorization: `Bearer ${env.WHATSAPP_WEBHOOK_TOKEN}` } : {});
  }
  return { status: 'enviado' };
}

// ---------- Registro ----------
function log({ postId = null, userId = null, channel, recipient, subject = null, status, error = null }) {
  q.run('INSERT INTO notifications (post_id, user_id, channel, recipient, subject, status, error) VALUES (?,?,?,?,?,?,?)',
    postId, userId, channel, recipient, subject, status, error);
}

async function safeSend(meta, fn) {
  try {
    const r = await fn();
    log({ ...meta, status: r.status });
    return r.status;
  } catch (e) {
    console.error(`[notificação] falha ${meta.channel} → ${meta.recipient}:`, e.message);
    log({ ...meta, status: 'erro', error: String(e.message).slice(0, 500) });
    return 'erro';
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Mensagens prontas ----------
export const POST_TYPES = {
  aviso: 'Aviso', feriado: 'Feriado', reuniao: 'Reunião', evento: 'Evento',
  passeio: 'Passeio', cardapio: 'Cardápio', matricula: 'Matrículas', atualizacao: 'Atualização do site',
};

function formatDate(d, t) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}${t ? ` às ${t}` : ''}`;
}

/** Notifica todos os pais ativos sobre uma publicação do mural (executa em segundo plano). */
export function notifyParentsAboutPost(post) {
  const parents = q.all("SELECT id, name, email, whatsapp, notify_email, notify_whatsapp FROM users WHERE role = 'pai' AND active = 1");
  const s = getSettings();
  const label = POST_TYPES[post.type] || 'Aviso';
  const when = formatDate(post.event_date, post.event_time);
  const link = `${SITE_URL()}/pais.html#mural`;
  const excerpt = post.body.length > 400 ? post.body.slice(0, 400) + '…' : post.body;
  const subject = `${label}: ${post.title} — ${s.school_name}`;

  (async () => {
    let ok = 0;
    for (const p of parents) {
      const first = p.name.split(' ')[0];
      if (p.notify_email) {
        const html = emailLayout({
          title: post.title,
          intro: `Olá, ${escapeHtml(first)}! Há uma nova publicação no mural da escola${when ? ` para <b>${escapeHtml(when)}</b>` : ''}.`,
          body: escapeHtml(excerpt),
          ctaText: 'Ver no mural', ctaUrl: link,
        });
        const text = `Olá, ${first}!\n${label}: ${post.title}\n${when ? `Data: ${when}\n` : ''}\n${excerpt}\n\nVeja no mural: ${link}`;
        if (await safeSend({ postId: post.id, userId: p.id, channel: 'email', recipient: p.email, subject }, () => sendEmail(p.email, subject, html, text)) === 'enviado') ok++;
      }
      if (p.notify_whatsapp) {
        const msg = `📢 *${s.school_name}*\n\nOlá, ${first}! *${label}: ${post.title}*${when ? `\n🗓️ ${when}` : ''}\n\n${excerpt}\n\n👉 Veja no mural: ${link}`;
        if (await safeSend({ postId: post.id, userId: p.id, channel: 'whatsapp', recipient: p.whatsapp, subject }, () => sendWhatsApp(p.whatsapp, msg)) === 'enviado') ok++;
        await sleep(Number(env.WHATSAPP_DELAY_MS || 1200)); // evita bloqueio por envio em massa
      }
    }
    q.run("UPDATE posts SET notified_at = datetime('now') WHERE id = ?", post.id);
    console.log(`[notificação] publicação #${post.id}: ${ok} envio(s) concluído(s) para ${parents.length} responsável(is).`);
  })();
  return parents.length;
}

/** Mensagem individual (ex.: status de documento, recuperação de senha). */
export async function notifyUser(user, { subject, title, intro, body = '', ctaText, ctaUrl, whatsappText }) {
  const html = emailLayout({ title, intro: escapeHtml(intro), body: escapeHtml(body), ctaText, ctaUrl });
  const text = `${intro}\n\n${body}${ctaUrl ? `\n\n${ctaUrl}` : ''}`;
  const results = {};
  if (user.email) results.email = await safeSend({ userId: user.id, channel: 'email', recipient: user.email, subject }, () => sendEmail(user.email, subject, html, text));
  if (whatsappText && user.whatsapp) {
    results.whatsapp = await safeSend({ userId: user.id, channel: 'whatsapp', recipient: user.whatsapp, subject }, () => sendWhatsApp(user.whatsapp, whatsappText));
  }
  return results;
}

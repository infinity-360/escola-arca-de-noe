import { $, $$, api, esc, postCard, WA_ICON } from './common.js';

const state = { settings: {} };

// ---------- Menu e cabeçalho ----------
const nav = $('#nav');
$('#menuToggle').addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  $('#menuToggle').setAttribute('aria-expanded', open);
  $('#menuToggle').textContent = open ? '✕' : '☰';
  nav.style.setProperty('--links-h', $('#navLinks').offsetHeight + 'px');
});
$$('#navLinks a').forEach((a) => a.addEventListener('click', () => { nav.classList.remove('open'); $('#menuToggle').textContent = '☰'; }));
addEventListener('scroll', () => $('.site-header').classList.toggle('scrolled', scrollY > 10), { passive: true });
$('#year').textContent = new Date().getFullYear();
$('#waFloat').innerHTML = WA_ICON;

// Animação de entrada
const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
const observe = () => $$('.reveal:not(.in)').forEach((el) => io.observe(el));
observe();

// ---------- Conteúdo dinâmico ----------
function applySettings(s) {
  state.settings = s;
  $$('[data-s]').forEach((el) => { const v = s[el.dataset.s]; if (v !== undefined) el.textContent = v; });
  // Título com destaque entre *asteriscos*
  $('#heroTitle').innerHTML = esc(s.hero_title).replace(/\*(.+?)\*/, '<span class="hl">$1</span>').replace(/\*/g, '');
  const waBase = `https://wa.me/${encodeURIComponent(s.whatsapp)}`;
  $$('[data-wa]').forEach((a) => { a.href = waBase + (a.dataset.waText ? `?text=${encodeURIComponent(a.dataset.waText)}` : ''); });
  $$('[data-ig]').forEach((a) => { a.href = `https://www.instagram.com/${encodeURIComponent(s.instagram)}/`; });
  const email = $('#emailItem');
  if (s.email) email.href = `mailto:${s.email}`; else email.classList.add('hidden');
  const mq = encodeURIComponent(s.map_query || s.address);
  $('#mapFrame').src = `https://www.google.com/maps?q=${mq}&output=embed`;
  $('#mapLink').href = `https://www.google.com/maps/search/?api=1&query=${mq}`;
  $('#ribbon').classList.toggle('hidden', !s.enrollment_banner);
  $('#tourModalTitle').textContent = s.tour_title || 'Tour virtual 360°';
  if (!s.tour_url) $$('[data-open-tour]').forEach((b) => b.closest('#tour') ? $('#tour').classList.add('hidden') : b.classList.add('hidden'));
}

function renderSegments(list) {
  $('#segments').innerHTML = list.map((s) => `
    <article class="segment c-${esc(s.color)} reveal">
      <div class="seg-icon">${esc(s.icon)}</div>
      ${s.age ? `<span class="seg-age">${esc(s.age)}</span>` : ''}
      <h3>${esc(s.title)}</h3>
      <p>${esc(s.description)}</p>
    </article>`).join('');
}

function renderMural(posts, types) {
  $('#muralList').innerHTML = posts.length
    ? posts.map((p) => postCard(p, types)).join('')
    : '<div class="empty">Nenhum aviso publicado no momento. 🌈</div>';
}

function renderGallery(items) {
  $('#gallery').innerHTML = items.map((g) => `
    <figure class="reveal" tabindex="0" data-src="${esc(g.src)}" data-cap="${esc(g.caption || '')}">
      <img src="${esc(g.src)}" alt="${esc(g.caption || 'Foto da escola')}" loading="lazy">
      ${g.caption ? `<figcaption>${esc(g.caption)}</figcaption>` : ''}
    </figure>`).join('');
  $('#galeria').classList.toggle('hidden', !items.length);
}

api('/api/public/site').then((d) => {
  applySettings(d.settings);
  renderSegments(d.segments);
  renderMural(d.posts, d.types);
  renderGallery(d.gallery);
  observe();
}).catch(() => { $('#muralList').innerHTML = '<div class="empty">Não foi possível carregar o mural agora.</div>'; });

// ---------- Lightbox da galeria ----------
const lb = $('#lightbox');
function openLb(fig) { $('#lbImg').src = fig.dataset.src; $('#lbImg').alt = fig.dataset.cap; lb.classList.add('open'); $('#lbClose').focus(); }
$('#gallery').addEventListener('click', (e) => { const f = e.target.closest('figure'); if (f) openLb(f); });
$('#gallery').addEventListener('keydown', (e) => { const f = e.target.closest('figure'); if (f && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openLb(f); } });
lb.addEventListener('click', (e) => { if (e.target === lb || e.target.id === 'lbClose') lb.classList.remove('open'); });

// ---------- Tour 360° ----------
// O tour abre DENTRO do site (iframe em tela cheia). O sandbox bloqueia pop-ups,
// novas abas e navegação da página principal, então o visitante nunca sai do site.
const modal = $('#tourModal');
const wrap = $('#tourWrap');
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;

function requestFs(el) {
  const fn = el.requestFullscreen || el.webkitRequestFullscreen;
  if (fn) { try { const r = fn.call(el); r?.catch?.(() => {}); } catch { /* iOS não suporta: mantém o modal ocupando a tela */ } }
}
function exitFs() {
  const fn = document.exitFullscreen || document.webkitExitFullscreen;
  if (fsEl() && fn) fn.call(document)?.catch?.(() => {});
}

function openTour() {
  const url = state.settings.tour_url;
  if (!url) return;
  if (!wrap.querySelector('iframe')) {
    const f = document.createElement('iframe');
    f.title = state.settings.tour_title || 'Tour virtual 360°';
    f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-pointer-lock allow-orientation-lock allow-presentation');
    f.setAttribute('allow', 'fullscreen; accelerometer; gyroscope; magnetometer; xr-spatial-tracking');
    f.setAttribute('allowfullscreen', '');
    f.referrerPolicy = 'no-referrer';
    f.addEventListener('load', () => wrap.querySelector('.tour-loading')?.remove());
    f.src = url;
    wrap.append(f);
  }
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  requestFs(modal);
  history.pushState({ tour: true }, '', '#tour-360');
}

function closeTour(fromHistory = false) {
  if (!modal.classList.contains('open')) return;
  exitFs();
  modal.classList.remove('open');
  document.body.style.overflow = '';
  if (!fromHistory && history.state?.tour) history.back();
}

$$('[data-open-tour]').forEach((b) => b.addEventListener('click', openTour));
$('#tourClose').addEventListener('click', () => closeTour());
$('#tourFs').addEventListener('click', () => (fsEl() ? exitFs() : requestFs(modal)));
document.addEventListener('fullscreenchange', () => { $('#tourFs').textContent = fsEl() ? '⤢ Sair da tela cheia' : '⛶ Tela cheia'; });
addEventListener('popstate', () => closeTour(true));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !fsEl()) closeTour(); });
if (location.hash === '#tour-360') history.replaceState(null, '', '#tour');

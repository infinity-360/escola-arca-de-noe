import { $, $$, api, esc, toast, fmtDate, fmtDateTime, fmtSize, isPast, maskPhone, phoneFromIntl, setupPasswordToggles, formData, submitting, showAlert, openModal, closeModal, TYPE_ICONS } from './common.js';

let me = null;
let isDir = false;
const cache = { posts: [], types: {}, segments: [], staff: [], parents: [] };
let docFilter = 'enviado';

setupPasswordToggles();

// =============== AUTENTICAÇÃO ===============
function showBox(name) {
  ['login', 'forgot', 'setup'].forEach((b) => $(`#${b}Box`).classList.toggle('hidden', b !== name));
}
$$('[data-go]').forEach((b) => b.addEventListener('click', () => showBox(b.dataset.go)));
maskPhone($('#setupForm').whatsapp);

$('#loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  submitting(e.target, async () => {
    me = (await api('/api/auth/login', { method: 'POST', body: { ...formData(e.target), area: 'equipe' } })).user;
    enterApp();
  });
});
$('#forgotForm').addEventListener('submit', (e) => {
  e.preventDefault();
  submitting(e.target, async () => showAlert(e.target, (await api('/api/auth/forgot', { method: 'POST', body: formData(e.target) })).message));
});
$('#setupForm').addEventListener('submit', (e) => {
  e.preventDefault();
  submitting(e.target, async () => {
    const d = formData(e.target);
    if (d.password !== d.password2) throw new Error('As senhas não conferem.');
    me = (await api('/api/auth/setup', { method: 'POST', body: d })).user;
    toast('Conta da direção criada! 🎉', 'ok');
    enterApp();
  });
});
$('#logoutBtn').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  location.href = '/equipe.html';
});

// =============== NAVEGAÇÃO ===============
const app = $('#appView');
$('#menuBtn').addEventListener('click', () => app.classList.toggle('menu-open'));
$('#scrim').addEventListener('click', () => app.classList.remove('menu-open'));

const loaders = {
  inicio: loadHome, mural: loadPosts, documentos: loadDocs, familias: loadParents,
  galeria: loadGallery, site: loadSite, equipe: loadStaff, notificacoes: loadNotifs, dados: fillMe,
};
function showTab(tab) {
  if (!loaders[tab] || (tab === 'site' && !isDir)) tab = 'inicio';
  $$('[data-panel]').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== tab));
  $$('#sideNav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  app.classList.remove('menu-open');
  if (location.hash !== `#${tab}`) history.replaceState(null, '', `#${tab}`);
  loaders[tab]();
  scrollTo(0, 0);
}
$$('#sideNav button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

function enterApp() {
  isDir = me.role === 'diretor';
  $('#boot').classList.add('hidden');
  $('#authView').classList.add('hidden');
  app.classList.remove('hidden');
  $('#uName').textContent = me.name;
  $('#uRole').textContent = isDir ? 'Diretor(a)' : 'Professor(a)';
  $$('.first-name').forEach((el) => (el.textContent = me.name.split(' ')[0]));
  $$('.only-dir').forEach((el) => el.classList.toggle('hidden', !isDir));
  showTab(location.hash.slice(1) || 'inicio');
}

function handleErr(e) {
  if (e.status === 401) { location.reload(); return; }
  toast(e.message, 'err');
}
const roleLabel = (r) => (r === 'diretor' ? 'Diretor(a)' : 'Professor(a)');

// =============== INÍCIO ===============
function channelsHtml(ch) {
  const wa = ch.whatsapp ? { zapi: 'Z-API', evolution: 'Evolution API', meta: 'WhatsApp Cloud API (Meta)', webhook: 'Webhook' }[ch.whatsapp] : null;
  return `<div class="list">
    <div class="list-item"><span class="ic">✉️</span><div class="grow"><b>E-mail</b><small>${ch.email ? 'Configurado (SMTP)' : 'Não configurado: defina SMTP_* no arquivo .env'}</small></div><span class="status ${ch.email ? 'st-aprovado' : 'st-enviado'}">${ch.email ? 'Ativo' : 'Pendente'}</span></div>
    <div class="list-item"><span class="ic">💬</span><div class="grow"><b>WhatsApp</b><small>${wa ? `Integração: ${wa}` : 'Não configurado: use o envio manual no mural ou configure WHATSAPP_PROVIDER no .env'}</small></div><span class="status ${wa ? 'st-aprovado' : 'st-enviado'}">${wa ? 'Ativo' : 'Manual'}</span></div>
  </div>`;
}
async function loadHome() {
  try {
    const s = await api('/api/admin/stats');
    $('#stats').innerHTML = [
      ['👨‍👩‍👧', s.parents, 'famílias cadastradas', 'var(--green-soft)'],
      ['🧒', s.children, 'crianças', 'var(--blue-soft)'],
      ['📄', s.pendingDocs, 'documentos em análise', 'var(--yellow-soft)'],
      ['📌', s.posts, 'publicações no mural', 'var(--purple-soft)'],
    ].map(([ic, n, l, c]) => `<div class="stat" style="--cs:${c}"><span class="ic">${ic}</span><div><b>${n}</b><small>${l}</small></div></div>`).join('');
    $('#upcoming').innerHTML = s.upcoming.length ? s.upcoming.map((p) => `
      <div class="list-item"><span class="ic">${TYPE_ICONS[p.type] || '📢'}</span><div class="grow"><b>${esc(p.title)}</b><small>${fmtDate(p.event_date)}${p.event_time ? ` às ${esc(p.event_time)}` : ''}</small></div></div>`).join('')
      : '<div class="empty">Nenhum evento com data futura.</div>';
    $('#channels').innerHTML = channelsHtml(s.channels);
    setPend(s.pendingDocs);
  } catch (e) { handleErr(e); }
}
function setPend(n) { const c = $('#pendCount'); c.textContent = n; c.classList.toggle('hidden', !n); }

// =============== MURAL ===============
async function loadPosts() {
  try {
    const d = await api('/api/admin/posts');
    cache.posts = d.posts; cache.types = d.types;
    $('#postType').innerHTML = Object.entries(d.types).map(([k, v]) => `<option value="${k}">${TYPE_ICONS[k] || ''} ${esc(v)}</option>`).join('');
    $('#postRows').innerHTML = d.posts.length ? d.posts.map((p) => `
      <tr>
        <td><b>${p.pinned ? '📌 ' : ''}${esc(p.title)}</b><br><small class="muted">${TYPE_ICONS[p.type] || ''} ${esc(d.types[p.type] || p.type)} · por ${esc(p.author_name || 'sistema')}</small></td>
        <td>${p.event_date ? `<span class="${isPast(p.event_date) ? 'muted' : ''}">${fmtDate(p.event_date)}${p.event_time ? `<br><small>${esc(p.event_time)}</small>` : ''}</span>` : '—'}</td>
        <td>${p.visibility === 'pais' ? '🔒 Pais' : '🌍 Todos'}</td>
        <td>${p.notified_at ? `<small>✅ ${fmtDateTime(p.notified_at)}<br>${p.sent_count} envio(s)</small>` : '<small class="muted">Não enviado</small>'}</td>
        <td><div class="row-actions">
          <button class="btn btn-ghost btn-sm" data-edit="${p.id}">Editar</button>
          <button class="btn btn-ghost btn-sm" data-notify="${p.id}" title="Enviar notificação">🔔</button>
          <button class="btn btn-ghost btn-sm" data-manual="${p.id}" title="Enviar manualmente pelo WhatsApp">💬</button>
          <button class="btn btn-ghost btn-sm" data-del="${p.id}" title="Excluir">🗑️</button>
        </div></td>
      </tr>`).join('') : '<tr><td colspan="5"><div class="empty">Nenhuma publicação.</div></td></tr>';
  } catch (e) { handleErr(e); }
}

function editPost(p = null) {
  const f = $('#postForm');
  f.reset();
  f.querySelector('.form-alert').className = 'form-alert hidden';
  if (!cache.types || !Object.keys(cache.types).length) loadPosts();
  f.id.value = p?.id || '';
  if (p) {
    f.type.value = p.type; f.visibility.value = p.visibility; f.title.value = p.title;
    f.event_date.value = p.event_date || ''; f.event_time.value = p.event_time || ''; f.body.value = p.body;
    f.pinned.checked = !!p.pinned; f.notify.checked = false;
  }
  $('#rmImgWrap').classList.toggle('hidden', !p?.image);
  $('#postModalTitle').textContent = p ? 'Editar publicação' : 'Novo aviso';
  f.querySelector('[type=submit]').textContent = p ? 'Salvar alterações' : 'Publicar';
  openModal('postModal');
}
$$('[data-new-post]').forEach((b) => b.addEventListener('click', async () => { if (!Object.keys(cache.types).length) await loadPosts(); editPost(); }));

$('#postForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  submitting(f, async () => {
    const fd = new FormData(f);
    ['pinned', 'notify', 'remove_image'].forEach((k) => fd.set(k, f[k].checked ? '1' : '0'));
    if (!fd.get('image')?.size) fd.delete('image');
    const id = fd.get('id');
    const r = await api(id ? `/api/admin/posts/${id}` : '/api/admin/posts', { method: id ? 'PUT' : 'POST', form: fd });
    closeModal('postModal');
    toast(r.notified ? `Publicado! Notificando ${r.notified} família(s)… 📲` : 'Publicação salva!', 'ok');
    loadPosts();
  });
});

$('#postRows').addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const id = b.dataset.edit || b.dataset.notify || b.dataset.manual || b.dataset.del;
  try {
    if (b.dataset.edit) editPost(cache.posts.find((p) => p.id === Number(id)));
    if (b.dataset.notify && confirm('Enviar esta publicação por e-mail e WhatsApp para todas as famílias?')) {
      const r = await api(`/api/admin/posts/${id}/notify`, { method: 'POST' });
      toast(`Enviando para ${r.notified} família(s)… 📲`, 'ok');
      setTimeout(loadPosts, 2500);
    }
    if (b.dataset.manual) openManual(id);
    if (b.dataset.del && confirm('Excluir esta publicação?')) {
      await api(`/api/admin/posts/${id}`, { method: 'DELETE' });
      toast('Publicação excluída.'); loadPosts();
    }
  } catch (err) { handleErr(err); }
});

async function openManual(id) {
  const d = await api(`/api/admin/posts/${id}/manual`);
  $('#manualMsg').value = d.message;
  const render = () => {
    const msg = encodeURIComponent($('#manualMsg').value);
    $('#manualList').innerHTML = d.parents.length ? d.parents.map((p) => `
      <a class="list-item" style="text-decoration:none;color:inherit" href="https://wa.me/${esc(p.whatsapp)}?text=${msg}" target="_blank" rel="noopener" data-wa-link>
        <span class="ic">💬</span><div class="grow"><b>${esc(p.name)}</b><small>${esc(p.whatsapp_fmt)}</small></div><span class="status st-enviado">Abrir</span>
      </a>`).join('') : '<div class="empty">Nenhuma família com WhatsApp ativo.</div>';
  };
  render();
  $('#manualMsg').oninput = render;
  openModal('manualModal');
}
$('#manualList').addEventListener('click', (e) => {
  const a = e.target.closest('[data-wa-link]');
  if (a) { const s = a.querySelector('.status'); s.textContent = 'Aberto ✓'; s.className = 'status st-aprovado'; }
});
$('#copyMsg').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#manualMsg').value); toast('Mensagem copiada!', 'ok'); }
  catch { $('#manualMsg').select(); }
});

// =============== DOCUMENTOS ===============
const ST = { enviado: '⏳ Em análise', aprovado: '✅ Aprovado', recusado: '⚠️ Recusado' };
let docsCache = [];
async function loadDocs() {
  try {
    const d = await api(`/api/admin/documents${docFilter ? `?status=${docFilter}` : ''}`);
    docsCache = d.documents;
    $('#docRows').innerHTML = d.documents.length ? d.documents.map((x) => `
      <tr>
        <td><b>${esc(x.title)}</b><br><small class="muted">${esc(x.category)} · ${fmtSize(x.size)}</small></td>
        <td>${esc(x.parent_name)}${x.child_name ? `<br><small class="muted">🧒 ${esc(x.child_name)}</small>` : ''}</td>
        <td><small>${fmtDateTime(x.created_at)}</small></td>
        <td><span class="status st-${x.status}">${ST[x.status]}</span>${x.feedback ? `<br><small class="muted">${esc(x.feedback)}</small>` : ''}</td>
        <td><div class="row-actions">
          <a class="btn btn-ghost btn-sm" href="/api/documents/${x.id}/file" target="_blank" rel="noopener">Abrir</a>
          <button class="btn btn-sm btn-green" data-review="${x.id}">Conferir</button>
        </div></td>
      </tr>`).join('') : '<tr><td colspan="5"><div class="empty">Nenhum documento aqui.</div></td></tr>';
    if (docFilter === 'enviado') setPend(d.documents.length);
  } catch (e) { handleErr(e); }
}
$$('#docFilter button').forEach((b) => b.addEventListener('click', () => {
  docFilter = b.dataset.f;
  $$('#docFilter button').forEach((x) => x.classList.toggle('active', x === b));
  loadDocs();
}));
$('#docRows').addEventListener('click', (e) => {
  const b = e.target.closest('[data-review]'); if (!b) return;
  const x = docsCache.find((d) => d.id === Number(b.dataset.review));
  const f = $('#docForm');
  f.reset(); f.querySelector('.form-alert').className = 'form-alert hidden';
  f.id.value = x.id; f.feedback.value = x.feedback || '';
  $('#docInfo').innerHTML = `<b>${esc(x.title)}</b><br>${esc(x.category)} · ${esc(x.parent_name)}${x.child_name ? ` · ${esc(x.child_name)}` : ''}`;
  $('#docOpen').href = `/api/documents/${x.id}/file`;
  openModal('docModal');
});
$('#docForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  const status = e.submitter?.dataset.status || 'aprovado';
  submitting(f, async () => {
    await api(`/api/admin/documents/${f.id.value}`, { method: 'PUT', body: { status, feedback: f.feedback.value } });
    closeModal('docModal');
    toast(status === 'aprovado' ? 'Documento aprovado. Família avisada! ✅' : 'Reenvio solicitado. Família avisada.', 'ok');
    loadDocs();
  });
});

// =============== FAMÍLIAS ===============
async function loadParents() {
  try { cache.parents = (await api('/api/admin/parents')).parents; renderParents(); }
  catch (e) { handleErr(e); }
}
function renderParents() {
  const term = $('#famSearch').value.trim().toLowerCase();
  const list = cache.parents.filter((p) => !term || [p.name, p.email, p.whatsapp_fmt, ...p.children.map((c) => c.name)].join(' ').toLowerCase().includes(term));
  $('#famRows').innerHTML = list.length ? list.map((p) => `
    <tr style="${p.active ? '' : 'opacity:.55'}">
      <td><b>${esc(p.name)}</b>${p.active ? '' : ' <span class="status st-recusado">Desativado</span>'}<br><small class="muted">Desde ${fmtDate(p.created_at)}</small></td>
      <td><small>✉️ <a href="mailto:${esc(p.email)}">${esc(p.email)}</a>${p.notify_email ? '' : ' (sem avisos)'}<br>💬 <a href="https://wa.me/${esc(p.whatsapp)}" target="_blank" rel="noopener">${esc(p.whatsapp_fmt)}</a>${p.notify_whatsapp ? '' : ' (sem avisos)'}</small></td>
      <td>${p.children.length ? p.children.map((c) => `<small>🧒 <b>${esc(c.name)}</b>${c.turma ? ` · ${esc(c.turma)}` : ''}${c.birth_date ? ` · ${fmtDate(c.birth_date)}` : ''}${c.notes ? `<br><span class="muted">📝 ${esc(c.notes)}</span>` : ''}</small>`).join('<br>') : '<small class="muted">—</small>'}</td>
      <td><small>${p.docs} enviado(s)${p.pending ? `<br><span class="status st-enviado">${p.pending} em análise</span>` : ''}</small></td>
      <td>${isDir ? `<div class="row-actions">
        <button class="btn btn-ghost btn-sm" data-reset="${p.id}" title="Enviar link de nova senha">🔑</button>
        <button class="btn btn-ghost btn-sm" data-toggle="${p.id}" data-active="${p.active}">${p.active ? 'Desativar' : 'Ativar'}</button>
        <button class="btn btn-ghost btn-sm" data-deluser="${p.id}" title="Excluir cadastro">🗑️</button>
      </div>` : ''}</td>
    </tr>`).join('') : '<tr><td colspan="5"><div class="empty">Nenhuma família encontrada.</div></td></tr>';
}
$('#famSearch').addEventListener('input', renderParents);
$('#famRows').addEventListener('click', (e) => userActions(e, loadParents));

async function userActions(e, reload) {
  const b = e.target.closest('button'); if (!b) return;
  try {
    if (b.dataset.reset && confirm('Enviar um link de redefinição de senha por e-mail e WhatsApp?')) {
      await api(`/api/admin/users/${b.dataset.reset}/reset-password`, { method: 'POST' });
      toast('Link de nova senha enviado! 🔑', 'ok');
    }
    if (b.dataset.toggle) {
      await api(`/api/admin/parents/${b.dataset.toggle}/active`, { method: 'PUT', body: { active: b.dataset.active !== '1' } });
      toast('Situação atualizada.'); reload();
    }
    if (b.dataset.deluser && confirm('Excluir definitivamente este cadastro e todos os documentos enviados? Esta ação não pode ser desfeita.')) {
      await api(`/api/admin/users/${b.dataset.deluser}`, { method: 'DELETE' });
      toast('Cadastro excluído.'); reload();
    }
  } catch (err) { handleErr(err); }
}

// =============== GALERIA ===============
async function loadGallery() {
  try {
    const g = (await api('/api/admin/gallery')).gallery;
    $('#galList').innerHTML = g.length ? g.map((x) => `
      <div class="thumb"><img src="${esc(x.src)}" alt="" loading="lazy">
        <div class="tb">
          <input class="input" value="${esc(x.caption || '')}" data-cap="${x.id}" placeholder="Legenda" style="padding:8px 10px;font-size:.9rem">
          <div class="flex"><input class="input" type="number" value="${x.sort}" data-sort="${x.id}" title="Ordem" style="width:70px;padding:8px">
            <button class="btn btn-ghost btn-sm" data-save="${x.id}">💾</button><button class="btn btn-ghost btn-sm" data-delg="${x.id}">🗑️</button></div>
        </div>
      </div>`).join('') : '<div class="empty">A galeria está vazia.</div>';
  } catch (e) { handleErr(e); }
}
$('#galForm').addEventListener('submit', (e) => {
  e.preventDefault();
  submitting(e.target, async () => {
    if (!e.target.image.files[0]) throw new Error('Escolha uma foto.');
    await api('/api/admin/gallery', { method: 'POST', form: new FormData(e.target) });
    e.target.reset(); toast('Foto adicionada! 📸', 'ok'); loadGallery();
  });
});
$('#galList').addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b) return;
  try {
    if (b.dataset.save) {
      await api(`/api/admin/gallery/${b.dataset.save}`, { method: 'PUT', body: { caption: $(`[data-cap="${b.dataset.save}"]`).value, sort: $(`[data-sort="${b.dataset.save}"]`).value } });
      toast('Foto atualizada.', 'ok'); loadGallery();
    }
    if (b.dataset.delg && confirm('Remover esta foto da galeria?')) {
      await api(`/api/admin/gallery/${b.dataset.delg}`, { method: 'DELETE' });
      toast('Foto removida.'); loadGallery();
    }
  } catch (err) { handleErr(err); }
});

// =============== CONTEÚDO DO SITE ===============
const siteForm = $('#siteForm');
async function loadSite() {
  try {
    const [{ settings }, { segments }] = await Promise.all([api('/api/admin/settings'), api('/api/admin/segments')]);
    for (const [k, v] of Object.entries(settings)) if (siteForm[k] && siteForm[k].type !== 'checkbox') siteForm[k].value = k === 'whatsapp' ? phoneFromIntl(v) : v;
    cache.segments = segments;
    $('#segList').innerHTML = segments.map((s) => `
      <div class="list-item"><span class="ic">${esc(s.icon)}</span><div class="grow"><b>${esc(s.title)}</b><small>${esc(s.age || '')} · ${esc(s.description || '').slice(0, 90)}…</small></div>
        <div class="row-actions"><button class="btn btn-ghost btn-sm" data-seg="${s.id}">Editar</button><button class="btn btn-ghost btn-sm" data-delseg="${s.id}">🗑️</button></div></div>`).join('') || '<div class="empty">Nenhum segmento.</div>';
  } catch (e) { handleErr(e); }
}
$('#siteNotify').addEventListener('change', (e) => $('#siteNotifyFields').classList.toggle('hidden', !e.target.checked));
siteForm.addEventListener('submit', (e) => {
  e.preventDefault();
  submitting(siteForm, async () => {
    const r = await api('/api/admin/settings', { method: 'PUT', body: { ...formData(siteForm), notify: siteForm.notify.checked } });
    showAlert(siteForm, r.notified ? `Conteúdo salvo! Avisando ${r.notified} família(s). ✅` : 'Conteúdo salvo e já visível no site! ✅');
    siteForm.notify.checked = false; $('#siteNotifyFields').classList.add('hidden');
  });
});
function editSeg(s = {}) {
  const f = $('#segForm');
  f.reset(); f.querySelector('.form-alert').className = 'form-alert hidden';
  for (const k of ['id', 'title', 'age', 'description', 'color', 'icon', 'sort']) f[k].value = s[k] ?? (k === 'color' ? 'purple' : k === 'icon' ? '🧸' : '');
  $('#segTitle').textContent = s.id ? 'Editar segmento' : 'Novo segmento';
  openModal('segModal');
}
$('#newSeg').addEventListener('click', () => editSeg());
$('#segList').addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.seg) editSeg(cache.segments.find((s) => s.id === Number(b.dataset.seg)));
  if (b.dataset.delseg && confirm('Excluir este segmento?')) {
    await api(`/api/admin/segments/${b.dataset.delseg}`, { method: 'DELETE' }).catch(handleErr);
    loadSite();
  }
});
$('#segForm').addEventListener('submit', (e) => {
  e.preventDefault();
  submitting(e.target, async () => {
    const d = formData(e.target);
    await api(d.id ? `/api/admin/segments/${d.id}` : '/api/admin/segments', { method: d.id ? 'PUT' : 'POST', body: d });
    closeModal('segModal'); toast('Segmento salvo!', 'ok'); loadSite();
  });
});

// =============== EQUIPE ===============
async function loadStaff() {
  try {
    cache.staff = (await api('/api/admin/staff')).staff;
    $('#staffRows').innerHTML = cache.staff.map((u) => `
      <tr style="${u.active ? '' : 'opacity:.55'}">
        <td><b>${esc(u.name)}</b>${u.id === me.id ? ' <small class="muted">(você)</small>' : ''}${u.active ? '' : ' <span class="status st-recusado">Desativado</span>'}</td>
        <td><small>✉️ ${esc(u.email)}<br>💬 ${esc(u.whatsapp_fmt)}</small></td>
        <td><span class="status ${u.role === 'diretor' ? 'st-aprovado' : 'st-enviado'}">${roleLabel(u.role)}</span></td>
        <td><small>${u.last_login_at ? fmtDateTime(u.last_login_at) : 'Nunca acessou'}</small></td>
        <td>${isDir ? `<div class="row-actions">
          <button class="btn btn-ghost btn-sm" data-editstaff="${u.id}">Editar</button>
          <button class="btn btn-ghost btn-sm" data-reset="${u.id}" title="Enviar link de nova senha">🔑</button>
          ${u.id !== me.id ? `<button class="btn btn-ghost btn-sm" data-deluser="${u.id}" title="Excluir">🗑️</button>` : ''}
        </div>` : ''}</td>
      </tr>`).join('');
  } catch (e) { handleErr(e); }
}
const staffForm = $('#staffForm');
maskPhone(staffForm.whatsapp);
function editStaff(u = null) {
  staffForm.reset(); staffForm.querySelector('.form-alert').className = 'form-alert hidden';
  staffForm.id.value = u?.id || '';
  if (u) { staffForm.name.value = u.name; staffForm.email.value = u.email; staffForm.whatsapp.value = u.whatsapp_fmt; staffForm.role.value = u.role; staffForm.active.value = u.active ? '1' : '0'; }
  $('#staffActiveWrap').classList.toggle('hidden', !u);
  $('#staffHint').classList.toggle('hidden', !!u);
  $('#staffTitle').textContent = u ? 'Editar membro' : 'Adicionar membro';
  openModal('staffModal');
}
$('#newStaff').addEventListener('click', () => editStaff());
$('#staffRows').addEventListener('click', (e) => {
  const b = e.target.closest('[data-editstaff]');
  if (b) return editStaff(cache.staff.find((u) => u.id === Number(b.dataset.editstaff)));
  userActions(e, loadStaff);
});
staffForm.addEventListener('submit', (e) => {
  e.preventDefault();
  submitting(staffForm, async () => {
    const d = formData(staffForm);
    await api(d.id ? `/api/admin/staff/${d.id}` : '/api/admin/staff', { method: d.id ? 'PUT' : 'POST', body: { ...d, active: d.active === '1' } });
    closeModal('staffModal');
    toast(d.id ? 'Membro atualizado.' : 'Membro adicionado! Link de acesso enviado. 📲', 'ok');
    loadStaff();
  });
});

// =============== NOTIFICAÇÕES ===============
const STN = { enviado: '✅ Enviado', erro: '❌ Erro', nao_configurado: '⚙️ Canal não configurado' };
async function loadNotifs() {
  try {
    const d = await api('/api/admin/notifications');
    $('#notifChannels').innerHTML = channelsHtml(d.channels);
    $('#notifRows').innerHTML = d.log.length ? d.log.map((n) => `
      <tr><td><small>${fmtDateTime(n.created_at)}</small></td>
        <td>${n.channel === 'email' ? '✉️ E-mail' : '💬 WhatsApp'}</td>
        <td><small><b>${esc(n.user_name || '')}</b><br>${esc(n.channel === 'whatsapp' ? phoneFromIntl(n.recipient) : n.recipient)}</small></td>
        <td><small>${esc(n.subject || n.post_title || '')}</small></td>
        <td><span class="status st-${esc(n.status)}">${STN[n.status] || esc(n.status)}</span>${n.error ? `<br><small class="muted">${esc(n.error)}</small>` : ''}</td></tr>`).join('')
      : '<tr><td colspan="5"><div class="empty">Nenhuma notificação enviada ainda.</div></td></tr>';
  } catch (e) { handleErr(e); }
}
$('#testNotif').addEventListener('click', async () => {
  try {
    const r = await api('/api/admin/notifications/test', { method: 'POST' });
    toast(`E-mail: ${STN[r.email] || r.email} · WhatsApp: ${STN[r.whatsapp] || r.whatsapp}`, r.email === 'enviado' || r.whatsapp === 'enviado' ? 'ok' : '');
    loadNotifs();
  } catch (e) { handleErr(e); }
});

// =============== MEUS DADOS ===============
const meForm = $('#meForm');
maskPhone(meForm.whatsapp);
function fillMe() { meForm.name.value = me.name; meForm.email.value = me.email; meForm.whatsapp.value = phoneFromIntl(me.whatsapp); }
meForm.addEventListener('submit', (e) => {
  e.preventDefault();
  submitting(meForm, async () => {
    me = (await api('/api/me', { method: 'PUT', body: formData(meForm) })).user;
    $('#uName').textContent = me.name;
    showAlert(meForm, 'Dados atualizados!');
  });
});
$('#pwForm').addEventListener('submit', (e) => {
  e.preventDefault();
  submitting(e.target, async () => {
    const d = formData(e.target);
    if (d.password !== d.password2) throw new Error('As senhas não conferem.');
    await api('/api/me/password', { method: 'PUT', body: d });
    e.target.reset(); showAlert(e.target, 'Senha alterada!');
  });
});

// =============== INÍCIO ===============
(async () => {
  try {
    const { user } = await api('/api/auth/me');
    if (user && user.role !== 'pai') { me = user; return enterApp(); }
    const st = await api('/api/auth/setup-status');
    $('#boot').classList.add('hidden');
    $('#authView').classList.remove('hidden');
    if (st.needsSetup) { $('#setupKeyField').classList.toggle('hidden', !st.requiresKey); showBox('setup'); }
    else showBox('login');
    if (user) showAlert($('#loginForm'), 'Você está conectado como responsável. Entre com uma conta da equipe.', 'info');
  } catch (e) { $('#boot').innerHTML = `<div class="alert alert-error">${esc(e.message)}</div>`; }
})();

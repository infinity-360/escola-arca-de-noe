import { $, $$, api, esc, toast, postCard, fmtDate, fmtDateTime, fmtSize, isPast, maskPhone, phoneFromIntl, setupPasswordToggles, formData, submitting, showAlert, openModal, closeModal } from './common.js';

let me = null;
let children = [];
let muralData = { posts: [], types: {} };
let muralFilter = 'todos';

setupPasswordToggles();

// =============== AUTENTICAÇÃO ===============
function showBox(name) {
  ['login', 'register', 'forgot'].forEach((b) => $(`#${b}Box`).classList.toggle('hidden', b !== name));
  $(`#${name}Box input`)?.focus();
}
$$('[data-go]').forEach((b) => b.addEventListener('click', () => showBox(b.dataset.go)));

// Crianças no cadastro
function addKidBlock() {
  const n = $$('#kids .child-block').length;
  if (n >= 8) return;
  const div = document.createElement('div');
  div.className = 'child-block';
  div.innerHTML = `
    ${n ? '<button type="button" class="x-btn rm" aria-label="Remover criança">✕</button>' : ''}
    <div class="field"><label>Nome da criança</label><input class="input" data-k="name" placeholder="Nome completo"></div>
    <div class="form-row">
      <div class="field"><label>Nascimento</label><input class="input" type="date" data-k="birth_date"></div>
      <div class="field"><label>Turma / série desejada</label><input class="input" data-k="turma" placeholder="Ex.: Maternal I"></div>
    </div>`;
  div.querySelector('.rm')?.addEventListener('click', () => div.remove());
  $('#kids').append(div);
}
addKidBlock();
$('#addKid').addEventListener('click', addKidBlock);
maskPhone($('#rWa'));

$('#loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  submitting(e.target, async () => {
    const d = await api('/api/auth/login', { method: 'POST', body: { ...formData(e.target), area: 'pais' } });
    me = d.user; enterApp();
  });
});

$('#registerForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  submitting(f, async () => {
    const d = formData(f);
    if (d.password !== d.password2) throw new Error('As senhas não conferem.');
    if (!f.consent.checked) throw new Error('Aceite a política de privacidade para continuar.');
    const kids = $$('#kids .child-block').map((b) => Object.fromEntries($$('[data-k]', b).map((i) => [i.dataset.k, i.value.trim()]))).filter((k) => k.name);
    const r = await api('/api/auth/register', { method: 'POST', body: { name: d.name, email: d.email, whatsapp: d.whatsapp, password: d.password, consent: true, children: kids } });
    me = r.user;
    toast('Cadastro concluído! Bem-vindo(a) 🎉', 'ok');
    enterApp();
  });
});

$('#forgotForm').addEventListener('submit', (e) => {
  e.preventDefault();
  submitting(e.target, async () => {
    const r = await api('/api/auth/forgot', { method: 'POST', body: formData(e.target) });
    showAlert(e.target, r.message, 'ok');
  });
});

$('#logoutBtn').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  location.href = 'pais.html';
});

// =============== PAINEL ===============
const app = $('#appView');
$('#menuBtn').addEventListener('click', () => app.classList.toggle('menu-open'));
$('#scrim').addEventListener('click', () => app.classList.remove('menu-open'));

function showTab(tab) {
  if (!$(`[data-panel="${tab}"]`)) tab = 'mural';
  $$('[data-panel]').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== tab));
  $$('#sideNav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  app.classList.remove('menu-open');
  if (location.hash !== `#${tab}`) history.replaceState(null, '', `#${tab}`);
  ({ mural: loadMural, filhos: loadChildren, documentos: loadDocs, dados: fillMe })[tab]?.();
  scrollTo(0, 0);
}
$$('#sideNav button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
addEventListener('hashchange', () => me && showTab(location.hash.slice(1)));

function enterApp() {
  $('#boot').classList.add('hidden');
  $('#authView').classList.add('hidden');
  app.classList.remove('hidden');
  $('#uName').textContent = me.name;
  $('#uEmail').textContent = me.email;
  $$('.first-name').forEach((el) => (el.textContent = me.name.split(' ')[0]));
  showTab(location.hash.slice(1) || 'mural');
  refreshDocCount();
}

// ----- Mural -----
async function loadMural() {
  try { muralData = await api('/api/pais/mural'); renderMural(); }
  catch (e) { handleErr(e); }
}
function renderMural() {
  let posts = muralData.posts;
  if (muralFilter === 'proximos') posts = posts.filter((p) => p.event_date && !isPast(p.event_date));
  if (muralFilter === 'pais') posts = posts.filter((p) => p.visibility === 'pais');
  $('#muralList').innerHTML = posts.length ? posts.map((p) => postCard(p, muralData.types)).join('') : '<div class="empty">Nenhum aviso por aqui. 🌈</div>';
}
$$('#muralFilter button').forEach((b) => b.addEventListener('click', () => {
  muralFilter = b.dataset.f;
  $$('#muralFilter button').forEach((x) => x.classList.toggle('active', x === b));
  renderMural();
}));

// ----- Filhos -----
async function loadChildren() {
  try {
    children = (await api('/api/pais/children')).children;
    $('#childList').innerHTML = children.length ? children.map((c) => `
      <div class="list-item">
        <span class="ic">🧒</span>
        <div class="grow"><b>${esc(c.name)}</b>
          <small>${c.birth_date ? `Nascimento: ${fmtDate(c.birth_date)}` : 'Nascimento não informado'}${c.turma ? ` · Turma: ${esc(c.turma)}` : ''}</small>
          ${c.notes ? `<small>📝 ${esc(c.notes)}</small>` : ''}
        </div>
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm" data-edit="${c.id}">Editar</button>
          <button class="btn btn-ghost btn-sm" data-del="${c.id}" aria-label="Remover ${esc(c.name)}">🗑️</button>
        </div>
      </div>`).join('') : '<div class="empty">Nenhuma criança cadastrada ainda.</div>';
  } catch (e) { handleErr(e); }
}
function editChild(c = {}) {
  const f = $('#childForm');
  f.reset();
  f.id.value = c.id || '';
  f.name.value = c.name || '';
  f.birth_date.value = c.birth_date || '';
  f.turma.value = c.turma || '';
  f.notes.value = c.notes || '';
  $('#childModalTitle').textContent = c.id ? 'Editar criança' : 'Adicionar criança';
  f.querySelector('.form-alert').className = 'form-alert hidden';
  openModal('childModal');
}
$('#newChild').addEventListener('click', () => editChild());
$('#childList').addEventListener('click', async (e) => {
  const ed = e.target.closest('[data-edit]');
  const del = e.target.closest('[data-del]');
  if (ed) editChild(children.find((c) => c.id === Number(ed.dataset.edit)));
  if (del && confirm('Remover esta criança do cadastro?')) {
    await api(`/api/pais/children/${del.dataset.del}`, { method: 'DELETE' }).catch(handleErr);
    toast('Criança removida.'); loadChildren();
  }
});
$('#childForm').addEventListener('submit', (e) => {
  e.preventDefault();
  submitting(e.target, async () => {
    const d = formData(e.target);
    await api(d.id ? `/api/pais/children/${d.id}` : '/api/pais/children', { method: d.id ? 'PUT' : 'POST', body: d });
    closeModal('childModal'); toast('Dados salvos!', 'ok'); loadChildren();
  });
});

// ----- Documentos -----
const ST_LABEL = { enviado: '⏳ Em análise', aprovado: '✅ Aprovado', recusado: '⚠️ Reenviar' };
async function loadDocs() {
  try {
    const [d, c] = await Promise.all([api('/api/pais/documents'), api('/api/pais/children')]);
    children = c.children;
    const cat = $('#dCat');
    if (!cat.options.length) cat.innerHTML = d.categories.map((x) => `<option>${esc(x)}</option>`).join('');
    const sel = $('#dChild');
    const cur = sel.value;
    sel.innerHTML = '<option value="">— Documento do responsável —</option>' + children.map((k) => `<option value="${k.id}">${esc(k.name)}</option>`).join('');
    sel.value = cur;
    $('#docList').innerHTML = d.documents.length ? d.documents.map((x) => `
      <div class="list-item">
        <span class="ic">${x.mime === 'application/pdf' ? '📕' : '🖼️'}</span>
        <div class="grow"><b>${esc(x.title)}</b>
          <small>${esc(x.category)}${x.child_name ? ` · ${esc(x.child_name)}` : ''} · ${fmtSize(x.size)} · ${fmtDateTime(x.created_at)}</small>
          ${x.feedback ? `<div class="feedback" style="${x.status === 'aprovado' ? 'background:var(--green-soft);color:#2D6B12' : ''}">💬 ${esc(x.feedback)}</div>` : ''}
        </div>
        <span class="status st-${x.status}">${ST_LABEL[x.status]}</span>
        <div class="row-actions">
          <a class="btn btn-ghost btn-sm" href="api/documents/${x.id}/file" target="_blank" rel="noopener">Ver</a>
          ${x.status !== 'aprovado' ? `<button class="btn btn-ghost btn-sm" data-deldoc="${x.id}" aria-label="Excluir">🗑️</button>` : ''}
        </div>
      </div>`).join('') : '<div class="empty">Nenhum documento enviado ainda.</div>';
    setDocCount(d.documents.filter((x) => x.status === 'recusado').length);
  } catch (e) { handleErr(e); }
}
function setDocCount(n) { const c = $('#docCount'); c.textContent = n; c.classList.toggle('hidden', !n); c.title = 'Documentos para reenviar'; }
function refreshDocCount() { api('/api/pais/documents').then((d) => setDocCount(d.documents.filter((x) => x.status === 'recusado').length)).catch(() => {}); }

$('#docList').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-deldoc]');
  if (b && confirm('Excluir este documento?')) {
    await api(`/api/pais/documents/${b.dataset.deldoc}`, { method: 'DELETE' }).catch(handleErr);
    toast('Documento excluído.'); loadDocs();
  }
});

const dz = $('#dropzone');
const fileInput = $('#dFile');
const updateDropLabel = () => { $('#dropLabel').textContent = fileInput.files[0] ? `📎 ${fileInput.files[0].name}` : 'Clique ou arraste o arquivo aqui'; };
fileInput.addEventListener('change', updateDropLabel);
['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
dz.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) { fileInput.files = e.dataTransfer.files; updateDropLabel(); } });

$('#docForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  submitting(f, async () => {
    const file = fileInput.files[0];
    if (!file) throw new Error('Selecione um arquivo.');
    if (file.size > 10 * 1024 * 1024) throw new Error('O arquivo passa de 10 MB.');
    await api('/api/pais/documents', { method: 'POST', form: new FormData(f) });
    f.reset(); updateDropLabel();
    toast('Documento enviado! A escola vai conferir em breve. ✅', 'ok');
    loadDocs();
  });
});

// ----- Meus dados -----
const meForm = $('#meForm');
maskPhone(meForm.whatsapp);
function fillMe() {
  meForm.name.value = me.name;
  meForm.email.value = me.email;
  meForm.whatsapp.value = phoneFromIntl(me.whatsapp);
  meForm.notify_email.checked = me.notify_email;
  meForm.notify_whatsapp.checked = me.notify_whatsapp;
}
meForm.addEventListener('submit', (e) => {
  e.preventDefault();
  submitting(meForm, async () => {
    const d = formData(meForm);
    const r = await api('/api/me', { method: 'PUT', body: { ...d, notify_email: meForm.notify_email.checked, notify_whatsapp: meForm.notify_whatsapp.checked } });
    me = r.user; $('#uName').textContent = me.name; $('#uEmail').textContent = me.email;
    showAlert(meForm, 'Dados atualizados com sucesso!');
  });
});
$('#pwForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  submitting(f, async () => {
    const d = formData(f);
    if (d.password !== d.password2) throw new Error('As senhas não conferem.');
    await api('/api/me/password', { method: 'PUT', body: d });
    f.reset(); showAlert(f, 'Senha alterada com sucesso!');
  });
});

function handleErr(e) {
  if (e.status === 401) { location.reload(); return; }
  toast(e.message, 'err');
}

// =============== INÍCIO ===============
api('/api/auth/me').then(({ user }) => {
  if (user && user.role === 'pai') { me = user; enterApp(); return; }
  $('#boot').classList.add('hidden');
  $('#authView').classList.remove('hidden');
  if (user) showAlert($('#loginForm'), 'Você está conectado com uma conta da equipe. Entre com uma conta de responsável ou acesse a Área da Equipe.', 'info');
  showBox(location.hash === '#cadastro' ? 'register' : 'login');
}).catch((e) => { $('#boot').innerHTML = `<div class="alert alert-error">${esc(e.message)}</div>`; });

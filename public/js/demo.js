// =====================================================================
// MODO DEMONSTRAÇÃO
// Usado quando o site está hospedado sem servidor (ex.: GitHub Pages).
// Simula a API no próprio navegador, guardando os dados no localStorage
// deste visitante. Nada é enviado para lugar nenhum: e-mails e WhatsApp
// são apenas simulados.
// =====================================================================

export const IS_DEMO = location.hostname.endsWith('github.io') || new URLSearchParams(location.search).has('demo') || sessionStorage.getItem('arca-demo') === '1';
if (new URLSearchParams(location.search).has('demo')) sessionStorage.setItem('arca-demo', '1');

const KEY = 'arca-demo-v1';
const SKEY = 'arca-demo-session';

export const DEMO_ACCOUNTS = {
  equipe: { email: 'diretora@demo.com', password: 'demo1234' },
  professor: { email: 'professora@demo.com', password: 'demo1234' },
  pais: { email: 'familia@demo.com', password: 'demo1234' },
};

const TYPES = { aviso: 'Aviso', feriado: 'Feriado', reuniao: 'Reunião', evento: 'Evento', passeio: 'Passeio', cardapio: 'Cardápio', matricula: 'Matrículas', atualizacao: 'Atualização do site' };
const DOC_CATEGORIES = ['Certidão de nascimento', 'RG/CPF do responsável', 'RG/CPF da criança', 'Comprovante de residência', 'Carteira de vacinação', 'Cartão SUS', 'Laudo / atestado médico', 'Declaração de transferência', 'Contrato / ficha de matrícula', 'Outro'];

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const today = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
const addDays = (n) => { const t = new Date(); t.setDate(t.getDate() + n); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };

function seed() {
  const y = new Date().getFullYear();
  const christmas = `${new Date() > new Date(y, 11, 25) ? y + 1 : y}-12-25`;
  return {
    seq: 100,
    settings: {
      school_name: 'Escola Arca de Noé',
      school_subtitle: 'Centro de Educação Infantil · Sarandi-PR',
      hero_title: 'Um lugar de *amor, fé* e descobertas para o seu filho crescer',
      hero_subtitle: 'Educação Infantil e Ensino Fundamental com educação cristã que acolhe, ensina e forma para a vida.',
      about_title: 'Educação cristã que acolhe, ensina e forma para a vida',
      about_text: 'Na Escola Arca de Noé, cada criança é recebida com carinho e cuidada em cada passo. Unimos uma proposta pedagógica sólida a valores cristãos, em um ambiente seguro, alegre e cheio de estímulos para brincar, aprender e conviver.\n\nNossa equipe acompanha de perto o desenvolvimento de cada aluno e mantém as famílias sempre por perto, com comunicação clara e transparente.',
      whatsapp: '5544991849508',
      phone: '(44) 99184-9508',
      email: '',
      instagram: 'arcadenoe.sarandi',
      address: 'Sarandi – PR',
      map_query: 'Escola Arca de Noé, Sarandi - PR',
      hours: 'Segunda a sexta, das 7h às 18h',
      tour_url: 'https://tour360.mgtour360.com.br/tour/happy-maringa/',
      tour_title: 'Conheça o lugar onde seu filho vai crescer',
      tour_subtitle: 'Faça um passeio virtual em 360° pelas salas, parquinho e espaços da escola, sem sair de casa.',
      enrollment_banner: 'Matrículas abertas! Garanta a vaga do seu filho.',
    },
    segments: [
      { id: 1, title: 'Berçário', age: 'Bebês', description: 'Acolhimento, rotina afetuosa e estímulos sensoriais para os primeiros passos, com equipe atenta a cada necessidade.', color: 'blue', icon: '🍼', sort: 1 },
      { id: 2, title: 'Maternal', age: '1 a 3 anos', description: 'Brincadeiras, música e convivência que desenvolvem a linguagem, a autonomia e a coordenação motora.', color: 'green', icon: '🧸', sort: 2 },
      { id: 3, title: 'Pré-escola', age: '4 e 5 anos', description: 'Preparação para a alfabetização com projetos, histórias bíblicas, arte e muita descoberta.', color: 'orange', icon: '🎨', sort: 3 },
      { id: 4, title: 'Ensino Fundamental', age: 'Anos iniciais', description: 'Base sólida em leitura, escrita e matemática, com formação de valores e acompanhamento próximo das famílias.', color: 'purple', icon: '📚', sort: 4 },
    ],
    gallery: [
      { id: 1, src: 'img/fachada.jpg', caption: 'Nossa escola', sort: 1 },
      { id: 2, src: 'img/galeria/foto1.jpg', caption: 'Carinho em cada passo', sort: 2 },
      { id: 3, src: 'img/galeria/foto4.jpg', caption: 'Colônia de férias', sort: 3 },
      { id: 4, src: 'img/galeria/foto8.jpg', caption: 'Parquinho', sort: 4 },
      { id: 5, src: 'img/galeria/foto3.jpg', caption: 'Descobertas todos os dias', sort: 5 },
    ],
    posts: [
      { id: 1, type: 'matricula', title: 'Matrículas abertas', body: 'Estamos com matrículas abertas para o próximo ano letivo. Agende uma visita e conheça nossa estrutura! Fale com a secretaria pelo WhatsApp.', event_date: null, event_time: null, image: null, pinned: 1, visibility: 'publico', author_id: 1, notified_at: null, created_at: now() },
      { id: 2, type: 'reuniao', title: 'Reunião de pais (exemplo)', body: 'Exemplo de aviso exclusivo para pais cadastrados. Na versão final, a equipe publica e as famílias recebem por e-mail e WhatsApp.', event_date: addDays(10), event_time: '19:00', image: null, pinned: 0, visibility: 'pais', author_id: 1, notified_at: now(), created_at: now() },
      { id: 3, type: 'evento', title: 'Festa da Família (exemplo)', body: 'Uma manhã especial com apresentações das crianças, brincadeiras e lanche compartilhado.', event_date: addDays(18), event_time: '09:00', image: null, pinned: 0, visibility: 'publico', author_id: 1, notified_at: null, created_at: now() },
      { id: 4, type: 'feriado', title: 'Feriado de Natal — não haverá aula', body: 'Desejamos a todas as famílias um Natal abençoado! A escola estará fechada no feriado.', event_date: christmas, event_time: null, image: null, pinned: 0, visibility: 'publico', author_id: 1, notified_at: null, created_at: now() },
    ],
    users: [
      { id: 1, role: 'diretor', name: 'Direção (demonstração)', email: DEMO_ACCOUNTS.equipe.email, whatsapp: '5544999990001', password: 'demo1234', active: 1, notify_email: 1, notify_whatsapp: 1, created_at: now(), last_login_at: null },
      { id: 2, role: 'professor', name: 'Professora (demonstração)', email: DEMO_ACCOUNTS.professor.email, whatsapp: '5544999990002', password: 'demo1234', active: 1, notify_email: 1, notify_whatsapp: 1, created_at: now(), last_login_at: null },
      { id: 3, role: 'pai', name: 'Família Exemplo', email: DEMO_ACCOUNTS.pais.email, whatsapp: '5544999990003', password: 'demo1234', active: 1, notify_email: 1, notify_whatsapp: 1, created_at: now(), last_login_at: null },
    ],
    children: [{ id: 1, parent_id: 3, name: 'Criança Exemplo', birth_date: '2022-05-14', turma: 'Maternal II', notes: 'Exemplo de observação: alergia a amendoim.' }],
    documents: [
      { id: 1, parent_id: 3, child_id: 1, title: 'Certidão de nascimento', category: 'Certidão de nascimento', original_name: 'certidao.pdf', mime: 'application/pdf', size: 184320, status: 'aprovado', feedback: 'Tudo certo, obrigado!', data: null, created_at: now() },
      { id: 2, parent_id: 3, child_id: 1, title: 'Carteira de vacinação', category: 'Carteira de vacinação', original_name: 'vacinas.jpg', mime: 'image/jpeg', size: 92160, status: 'enviado', feedback: null, data: null, created_at: now() },
    ],
    notifications: [],
  };
}

let db;
function load() {
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
  if (!db || !db.users) { db = seed(); save(); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch { throw err('O espaço de armazenamento da demonstração acabou. Use arquivos menores ou clique em “Restaurar demonstração”.', 413); }
}
export function resetDemo() { localStorage.removeItem(KEY); localStorage.removeItem(SKEY); }

const err = (message, status = 400) => Object.assign(new Error(message), { status });
const nextId = () => ++db.seq;
const me = () => db.users.find((u) => u.id === Number(localStorage.getItem(SKEY)) && u.active);
const fmtWa = (d) => { const m = String(d || '').match(/^55(\d{2})(\d{4,5})(\d{4})$/); return m ? `(${m[1]}) ${m[2]}-${m[3]}` : d; };
const pub = (u) => ({ id: u.id, role: u.role, name: u.name, email: u.email, whatsapp: u.whatsapp, whatsapp_fmt: fmtWa(u.whatsapp), notify_email: !!u.notify_email, notify_whatsapp: !!u.notify_whatsapp });
const normWa = (w) => { let d = String(w || '').replace(/\D/g, ''); if (d.length === 10 || d.length === 11) d = '55' + d; return d; };
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const truthy = (v) => v === true || v === 'true' || v === '1' || v === 1 || v === 'on';
function pwProblem(p) {
  p = String(p || '');
  if (p.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'A senha deve conter letras e números.';
  return null;
}
function contact(b) {
  const name = String(b.name || '').trim(); const email = String(b.email || '').trim().toLowerCase(); const whatsapp = normWa(b.whatsapp);
  if (name.length < 3) throw err('Informe o nome completo.');
  if (!isEmail(email)) throw err('Informe um e-mail válido.');
  if (!/^55\d{10,11}$/.test(whatsapp)) throw err('Informe um WhatsApp válido com DDD, ex.: (44) 99999-9999.');
  return { name, email, whatsapp };
}
function need(...roles) {
  const u = me();
  if (!u) throw err('Faça login para continuar.', 401);
  if (roles.length && !roles.includes(u.role)) throw err('Acesso não permitido para o seu perfil.', 403);
  return u;
}
function sortPosts(list) {
  const t = today();
  const up = (p) => (!p.event_date || p.event_date >= t ? 0 : 1);
  const key = (p) => p.event_date || p.created_at.slice(0, 10);
  return [...list].sort((a, b) => (b.pinned - a.pinned) || (up(a) - up(b)) || key(a).localeCompare(key(b)));
}
function simulateNotify(post) {
  const parents = db.users.filter((u) => u.role === 'pai' && u.active);
  for (const p of parents) {
    if (p.notify_email) db.notifications.unshift({ id: nextId(), post_id: post.id, user_id: p.id, channel: 'email', recipient: p.email, subject: `${TYPES[post.type]}: ${post.title}`, status: 'simulado', created_at: now() });
    if (p.notify_whatsapp) db.notifications.unshift({ id: nextId(), post_id: post.id, user_id: p.id, channel: 'whatsapp', recipient: p.whatsapp, subject: `${TYPES[post.type]}: ${post.title}`, status: 'simulado', created_at: now() });
  }
  post.notified_at = now();
  db.notifications = db.notifications.slice(0, 200);
  return parents.length;
}
const fileToDataUrl = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
async function readFile(form, field, maxMb) {
  const f = form?.get(field);
  if (!f || !f.size) return null;
  if (f.size > maxMb * 1024 * 1024) throw err(`Na demonstração, use arquivos de até ${maxMb} MB.`);
  return { name: f.name, type: f.type, size: f.size, data: await fileToDataUrl(f) };
}
const formObj = (form) => (form ? Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string')) : {});
const delay = () => new Promise((r) => setTimeout(r, 180));

// ---------------------------------------------------------------------
export async function demoApi(url, { method = 'GET', body = {}, form } = {}) {
  load();
  await delay();
  const u = new URL(url.replace(/^\/?/, '/'), location.origin);
  const path = u.pathname.replace(/^\/api\//, '');
  const b = form ? formObj(form) : (body || {});
  const M = method.toUpperCase();
  const m = (re) => path.match(re);
  let r;

  // ----- Público -----
  if (path === 'public/site') {
    return {
      settings: db.settings,
      segments: [...db.segments].sort((a, c) => a.sort - c.sort),
      gallery: [...db.gallery].sort((a, c) => a.sort - c.sort),
      posts: sortPosts(db.posts.filter((p) => p.visibility === 'publico')).slice(0, 12),
      types: TYPES,
    };
  }

  // ----- Autenticação -----
  if (path === 'auth/me') { const x = me(); return { user: x ? pub(x) : null }; }
  if (path === 'auth/setup-status') return { needsSetup: false, requiresKey: false };
  if (path === 'auth/logout') { localStorage.removeItem(SKEY); return { ok: true }; }
  if (path === 'auth/login') {
    const x = db.users.find((y) => y.email === String(b.email || '').trim().toLowerCase());
    if (!x || x.password !== b.password) throw err('E-mail ou senha incorretos.', 401);
    if (!x.active) throw err('Seu acesso está desativado. Fale com a secretaria da escola.', 403);
    const staff = x.role !== 'pai';
    if (b.area === 'equipe' && !staff) throw err('Este acesso é exclusivo da equipe. Use a Área dos Pais.', 403);
    if (b.area === 'pais' && staff) throw err('Esta conta é da equipe. Use a Área da Equipe.', 403);
    x.last_login_at = now(); save();
    localStorage.setItem(SKEY, x.id);
    return { user: pub(x) };
  }
  if (path === 'auth/register') {
    const c = contact(b);
    const p = pwProblem(b.password); if (p) throw err(p);
    if (!b.consent) throw err('É preciso aceitar a política de privacidade para se cadastrar.');
    if (db.users.some((y) => y.email === c.email)) throw err('Este e-mail já está cadastrado. Faça login ou recupere sua senha.', 409);
    const x = { id: nextId(), role: 'pai', ...c, password: b.password, active: 1, notify_email: 1, notify_whatsapp: 1, created_at: now(), last_login_at: now() };
    db.users.push(x);
    for (const k of (b.children || []).slice(0, 8)) if (String(k.name || '').trim().length >= 2) db.children.push({ id: nextId(), parent_id: x.id, name: k.name.trim(), birth_date: k.birth_date || null, turma: k.turma || null, notes: null });
    db.notifications.unshift({ id: nextId(), user_id: x.id, channel: 'email', recipient: x.email, subject: 'Boas-vindas ao portal', status: 'simulado', created_at: now() },
      { id: nextId(), user_id: x.id, channel: 'whatsapp', recipient: x.whatsapp, subject: 'Boas-vindas ao portal', status: 'simulado', created_at: now() });
    save(); localStorage.setItem(SKEY, x.id);
    return { user: pub(x) };
  }
  if (path === 'auth/forgot') return { ok: true, message: 'Na versão final, o link para criar uma nova senha chega por e-mail e WhatsApp. (Demonstração: nenhuma mensagem foi enviada.)' };
  if (path === 'auth/reset') throw err('Na demonstração, a redefinição por link não está disponível. Use as contas de demonstração.');

  // ----- Meus dados -----
  if (path === 'me' && M === 'PUT') {
    const x = need(); const c = contact(b);
    if (db.users.some((y) => y.email === c.email && y.id !== x.id)) throw err('Este e-mail já está em uso por outra conta.', 409);
    Object.assign(x, c, { notify_email: truthy(b.notify_email) ? 1 : 0, notify_whatsapp: truthy(b.notify_whatsapp) ? 1 : 0 }); save();
    return { user: pub(x) };
  }
  if (path === 'me/password') {
    const x = need();
    if (x.password !== b.current) throw err('Senha atual incorreta.');
    const p = pwProblem(b.password); if (p) throw err(p);
    x.password = b.password; save(); return { ok: true };
  }

  // ----- Pais -----
  if (path === 'pais/mural') { need('pai'); return { posts: sortPosts(db.posts), types: TYPES }; }
  if (path === 'pais/children') {
    const x = need('pai');
    if (M === 'GET') return { children: db.children.filter((c) => c.parent_id === x.id) };
    if (String(b.name || '').trim().length < 2) throw err('Informe o nome da criança.');
    db.children.push({ id: nextId(), parent_id: x.id, name: b.name.trim(), birth_date: b.birth_date || null, turma: b.turma || null, notes: b.notes || null }); save();
    return { ok: true };
  }
  if ((r = m(/^pais\/children\/(\d+)$/))) {
    const x = need('pai'); const id = Number(r[1]);
    if (M === 'DELETE') { db.children = db.children.filter((c) => !(c.id === id && c.parent_id === x.id)); save(); return { ok: true }; }
    const c = db.children.find((k) => k.id === id && k.parent_id === x.id); if (!c) throw err('Criança não encontrada.', 404);
    if (String(b.name || '').trim().length < 2) throw err('Informe o nome da criança.');
    Object.assign(c, { name: b.name.trim(), birth_date: b.birth_date || null, turma: b.turma || null, notes: b.notes || null }); save();
    return { ok: true };
  }
  if (path === 'pais/documents') {
    const x = need('pai');
    if (M === 'GET') {
      return {
        categories: DOC_CATEGORIES,
        documents: db.documents.filter((d) => d.parent_id === x.id).sort((a, c) => c.id - a.id)
          .map(({ data, ...d }) => ({ ...d, child_name: db.children.find((c) => c.id === d.child_id)?.name || null })),
      };
    }
    const f = await readFile(form, 'file', 1.5);
    if (!f) throw err('Selecione um arquivo (PDF, JPG, PNG ou WEBP).');
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(f.type)) throw err('Tipo de arquivo não permitido.');
    const category = DOC_CATEGORIES.includes(b.category) ? b.category : 'Outro';
    let childId = Number(b.child_id) || null;
    if (childId && !db.children.some((c) => c.id === childId && c.parent_id === x.id)) childId = null;
    db.documents.push({ id: nextId(), parent_id: x.id, child_id: childId, title: (b.title || '').trim() || category, category, original_name: f.name, mime: f.type, size: f.size, status: 'enviado', feedback: null, data: f.data, created_at: now() });
    save(); return { ok: true };
  }
  if ((r = m(/^pais\/documents\/(\d+)$/))) {
    const x = need('pai'); const d = db.documents.find((y) => y.id === Number(r[1]) && y.parent_id === x.id);
    if (!d) throw err('Documento não encontrado.', 404);
    if (d.status === 'aprovado') throw err('Documentos aprovados não podem ser excluídos. Fale com a secretaria.');
    db.documents = db.documents.filter((y) => y !== d); save(); return { ok: true };
  }

  // ----- Equipe -----
  const isAdmin = path.startsWith('admin/');
  const user = isAdmin ? need('professor', 'diretor') : null;
  const dir = () => { if (user.role !== 'diretor') throw err('Acesso não permitido para o seu perfil.', 403); };

  if (path === 'admin/stats') {
    return {
      parents: db.users.filter((x) => x.role === 'pai').length,
      children: db.children.length,
      pendingDocs: db.documents.filter((d) => d.status === 'enviado').length,
      posts: db.posts.length,
      upcoming: db.posts.filter((p) => p.event_date && p.event_date >= today()).sort((a, c) => a.event_date.localeCompare(c.event_date)).slice(0, 5),
      channels: { email: true, whatsapp: 'demo', demo: true },
    };
  }
  if (path === 'admin/posts') {
    if (M === 'GET') {
      return {
        types: TYPES,
        posts: [...db.posts].sort((a, c) => (c.pinned - a.pinned) || c.id - a.id).map((p) => ({
          ...p, author_name: db.users.find((x) => x.id === p.author_id)?.name || 'sistema',
          sent_count: db.notifications.filter((n) => n.post_id === p.id).length,
        })),
      };
    }
    const p = readPost(b);
    const img = await readFile(form, 'image', 1.5);
    const post = { id: nextId(), ...p, image: img?.data || null, author_id: user.id, notified_at: null, created_at: now() };
    db.posts.push(post);
    const notified = truthy(b.notify) ? simulateNotify(post) : 0;
    save(); return { post, notified };
  }
  if ((r = m(/^admin\/posts\/(\d+)(\/notify|\/manual)?$/))) {
    const post = db.posts.find((p) => p.id === Number(r[1])); if (!post) throw err('Publicação não encontrada.', 404);
    if (r[2] === '/notify') { const n = simulateNotify(post); save(); return { notified: n }; }
    if (r[2] === '/manual') {
      const when = post.event_date ? `\n🗓️ ${post.event_date.split('-').reverse().join('/')}${post.event_time ? ` às ${post.event_time}` : ''}` : '';
      return {
        message: `📢 *${db.settings.school_name}*\n\n*${TYPES[post.type]}: ${post.title}*${when}\n\n${post.body}\n\n👉 ${location.href.replace(/equipe\.html.*$/, '')}pais.html#mural`,
        parents: db.users.filter((x) => x.role === 'pai' && x.active && x.notify_whatsapp).map((x) => ({ id: x.id, name: x.name, whatsapp: x.whatsapp, whatsapp_fmt: fmtWa(x.whatsapp) })),
      };
    }
    if (M === 'DELETE') { db.posts = db.posts.filter((p) => p !== post); save(); return { ok: true }; }
    const p = readPost(b);
    const img = await readFile(form, 'image', 1.5);
    Object.assign(post, p);
    if (img) post.image = img.data; else if (truthy(b.remove_image)) post.image = null;
    const notified = truthy(b.notify) ? simulateNotify(post) : 0;
    save(); return { post, notified };
  }
  if (path === 'admin/settings') {
    if (M === 'GET') return { settings: db.settings };
    dir();
    for (const k of Object.keys(db.settings)) if (b[k] !== undefined) db.settings[k] = k === 'whatsapp' ? normWa(b[k]) : String(b[k]).trim();
    let notified = 0;
    if (truthy(b.notify)) {
      const post = { id: nextId(), type: 'atualizacao', title: b.notify_title || 'O site da escola foi atualizado', body: b.notify_body || '', event_date: null, event_time: null, image: null, pinned: 0, visibility: 'pais', author_id: user.id, created_at: now() };
      db.posts.push(post); notified = simulateNotify(post);
    }
    save(); return { settings: db.settings, notified };
  }
  if (path === 'admin/segments') {
    if (M === 'GET') return { segments: [...db.segments].sort((a, c) => a.sort - c.sort) };
    dir(); if (String(b.title || '').trim().length < 2) throw err('Informe o nome do segmento.');
    db.segments.push({ id: nextId(), title: b.title, age: b.age, description: b.description, color: b.color || 'purple', icon: b.icon || '🧸', sort: Number(b.sort) || 0 }); save();
    return { ok: true };
  }
  if ((r = m(/^admin\/segments\/(\d+)$/))) {
    dir(); const id = Number(r[1]);
    if (M === 'DELETE') db.segments = db.segments.filter((s) => s.id !== id);
    else Object.assign(db.segments.find((s) => s.id === id) || {}, { title: b.title, age: b.age, description: b.description, color: b.color, icon: b.icon, sort: Number(b.sort) || 0 });
    save(); return { ok: true };
  }
  if (path === 'admin/gallery') {
    if (M === 'GET') return { gallery: [...db.gallery].sort((a, c) => a.sort - c.sort) };
    const img = await readFile(form, 'image', 1.5); if (!img) throw err('Selecione uma imagem.');
    db.gallery.push({ id: nextId(), src: img.data, caption: b.caption || '', sort: Math.max(0, ...db.gallery.map((g) => g.sort)) + 1 }); save();
    return { ok: true };
  }
  if ((r = m(/^admin\/gallery\/(\d+)$/))) {
    const id = Number(r[1]);
    if (M === 'DELETE') db.gallery = db.gallery.filter((g) => g.id !== id);
    else Object.assign(db.gallery.find((g) => g.id === id) || {}, { caption: b.caption, sort: Number(b.sort) || 0 });
    save(); return { ok: true };
  }
  if (path === 'admin/parents') {
    return {
      parents: db.users.filter((x) => x.role === 'pai').sort((a, c) => a.name.localeCompare(c.name)).map((x) => ({
        ...pub(x), active: x.active, created_at: x.created_at, last_login_at: x.last_login_at,
        docs: db.documents.filter((d) => d.parent_id === x.id).length,
        pending: db.documents.filter((d) => d.parent_id === x.id && d.status === 'enviado').length,
        children: db.children.filter((c) => c.parent_id === x.id),
      })),
    };
  }
  if ((r = m(/^admin\/parents\/(\d+)\/active$/))) {
    dir(); const x = db.users.find((y) => y.id === Number(r[1]) && y.role === 'pai'); if (x) x.active = truthy(b.active) ? 1 : 0; save(); return { ok: true };
  }
  if ((r = m(/^admin\/users\/(\d+)(\/reset-password)?$/))) {
    dir(); const id = Number(r[1]);
    if (r[2]) return { ok: true, result: { email: 'simulado', whatsapp: 'simulado' } };
    if (id === user.id) throw err('Você não pode excluir a sua própria conta.');
    db.users = db.users.filter((y) => y.id !== id);
    db.children = db.children.filter((c) => c.parent_id !== id);
    db.documents = db.documents.filter((d) => d.parent_id !== id);
    save(); return { ok: true };
  }
  if (path === 'admin/documents') {
    const st = u.searchParams.get('status');
    return {
      documents: db.documents.filter((d) => !st || d.status === st)
        .sort((a, c) => ((c.status === 'enviado') - (a.status === 'enviado')) || c.id - a.id)
        .map(({ data, ...d }) => ({ ...d, parent_name: db.users.find((x) => x.id === d.parent_id)?.name || '—', child_name: db.children.find((c) => c.id === d.child_id)?.name || null })),
    };
  }
  if ((r = m(/^admin\/documents\/(\d+)$/))) {
    const d = db.documents.find((y) => y.id === Number(r[1])); if (!d) throw err('Documento não encontrado.', 404);
    if (b.status === 'recusado' && !String(b.feedback || '').trim()) throw err('Explique ao responsável o motivo da recusa.');
    d.status = b.status; d.feedback = String(b.feedback || '').trim() || null;
    const p = db.users.find((x) => x.id === d.parent_id);
    if (p) db.notifications.unshift({ id: nextId(), user_id: p.id, channel: 'whatsapp', recipient: p.whatsapp, subject: `Documento ${d.status}: ${d.title}`, status: 'simulado', created_at: now() });
    save(); return { ok: true };
  }
  if (path === 'admin/staff') {
    if (M === 'GET') return { staff: db.users.filter((x) => x.role !== 'pai').map((x) => ({ ...pub(x), active: x.active, created_at: x.created_at, last_login_at: x.last_login_at })) };
    dir(); const c = contact(b);
    if (db.users.some((y) => y.email === c.email)) throw err('Este e-mail já está cadastrado.', 409);
    db.users.push({ id: nextId(), role: b.role === 'diretor' ? 'diretor' : 'professor', ...c, password: 'demo1234', active: 1, notify_email: 1, notify_whatsapp: 1, created_at: now(), last_login_at: null });
    save(); return { ok: true, result: { email: 'simulado', whatsapp: 'simulado' } };
  }
  if ((r = m(/^admin\/staff\/(\d+)$/))) {
    dir(); const x = db.users.find((y) => y.id === Number(r[1]) && y.role !== 'pai'); if (!x) throw err('Membro não encontrado.', 404);
    const c = contact(b); const role = b.role === 'diretor' ? 'diretor' : 'professor'; const active = truthy(b.active) ? 1 : 0;
    if (x.id === user.id && (role !== 'diretor' || !active)) throw err('Você não pode rebaixar ou desativar a sua própria conta.');
    Object.assign(x, c, { role, active }); save(); return { ok: true };
  }
  if (path === 'admin/notifications') {
    return {
      channels: { email: true, whatsapp: 'demo', demo: true },
      log: db.notifications.map((n) => ({ ...n, user_name: db.users.find((x) => x.id === n.user_id)?.name || '', post_title: db.posts.find((p) => p.id === n.post_id)?.title || '' })),
    };
  }
  if (path === 'admin/notifications/test') return { email: 'simulado', whatsapp: 'simulado' };

  throw err('Função indisponível na demonstração.', 404);
}

function readPost(b) {
  const title = String(b.title || '').trim();
  if (title.length < 3) throw err('Informe um título.');
  return {
    type: TYPES[b.type] ? b.type : 'aviso', title, body: String(b.body || '').trim(),
    event_date: /^\d{4}-\d{2}-\d{2}$/.test(b.event_date || '') ? b.event_date : null,
    event_time: /^\d{2}:\d{2}$/.test(b.event_time || '') ? b.event_time : null,
    pinned: truthy(b.pinned) ? 1 : 0, visibility: b.visibility === 'pais' ? 'pais' : 'publico',
  };
}

// ---------------------------------------------------------------------
// Interface da demonstração: faixa de aviso, contas de teste e links
// ---------------------------------------------------------------------
function demoFile(id) {
  load();
  const d = db.documents.find((x) => x.id === id);
  const x = me();
  if (!d || !x || (x.role === 'pai' && d.parent_id !== x.id)) return alert('Documento não encontrado.');
  if (!d.data) return alert('Documento de exemplo: na versão final, o arquivo enviado pela família abre aqui.');
  fetch(d.data).then((r) => r.blob()).then((blob) => window.open(URL.createObjectURL(blob), '_blank'));
}
function demoCsv() {
  load();
  const rows = db.users.filter((x) => x.role === 'pai').map((p) => [p.name, p.email, fmtWa(p.whatsapp), p.created_at, db.children.filter((c) => c.parent_id === p.id).map((c) => c.name).join('; ')]);
  const csv = '﻿Nome;E-mail;WhatsApp;Cadastro;Crianças\n' + rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'familias-arca-de-noe.csv' });
  a.click();
}

if (IS_DEMO) {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]'); if (!a) return;
    const href = a.getAttribute('href');
    const doc = href.match(/^\/?api\/documents\/(\d+)\/file/);
    if (doc) { e.preventDefault(); demoFile(Number(doc[1])); }
    else if (/^\/?api\/admin\/parents\.csv/.test(href)) { e.preventDefault(); demoCsv(); }
  }, true);

  const ready = () => {
    const style = document.createElement('style');
    style.textContent = `.demo-bar{position:fixed;left:12px;bottom:12px;z-index:3000;background:#2D2244;color:#fff;border-radius:14px;padding:8px 12px;font:700 .8rem/1.3 Nunito,system-ui,sans-serif;box-shadow:0 10px 30px -10px rgba(0,0,0,.5);display:flex;gap:10px;align-items:center;max-width:calc(100% - 100px)}
      .demo-bar button{background:rgba(255,255,255,.16);color:#fff;border:0;border-radius:9px;padding:5px 9px;font:800 .75rem Nunito,sans-serif;cursor:pointer;white-space:nowrap}
      .demo-creds{background:#FFF6DA;border:2px dashed #FFC83D;border-radius:16px;padding:14px 16px;margin-bottom:20px;font-size:.92rem}
      .demo-creds b{display:block;margin-bottom:6px}.demo-creds .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:6px}
      .demo-creds code{background:#fff;border-radius:8px;padding:2px 8px;font-size:.85rem}`;
    document.head.append(style);

    const bar = document.createElement('div');
    bar.className = 'demo-bar';
    bar.innerHTML = '<span>🧪 Versão de demonstração: os dados ficam só neste navegador.</span><button type="button">Restaurar</button>';
    bar.querySelector('button').addEventListener('click', () => { if (confirm('Apagar as alterações feitas e restaurar a demonstração original?')) { resetDemo(); location.reload(); } });
    document.body.append(bar);

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      const isEquipe = location.pathname.endsWith('equipe.html');
      const accs = isEquipe
        ? [['Diretora', DEMO_ACCOUNTS.equipe], ['Professora', DEMO_ACCOUNTS.professor]]
        : [['Família', DEMO_ACCOUNTS.pais]];
      const box = document.createElement('div');
      box.className = 'demo-creds';
      box.innerHTML = `<b>🧪 Contas para testar a demonstração</b>${accs.map(([l, a]) => `<div class="row">${l}: <code>${a.email}</code> senha <code>${a.password}</code> <button type="button" class="btn btn-sm btn-ghost" data-email="${a.email}" data-pw="${a.password}">Usar</button></div>`).join('')}${isEquipe ? '' : '<div class="row" style="margin-top:8px">Você também pode criar um cadastro novo.</div>'}`;
      box.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-email]'); if (!btn) return;
        loginForm.email.value = btn.dataset.email; loginForm.password.value = btn.dataset.pw;
        loginForm.requestSubmit();
      });
      loginForm.closest('#loginBox').insertBefore(box, loginForm);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
}

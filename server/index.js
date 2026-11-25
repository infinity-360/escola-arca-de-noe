import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Carrega variáveis do arquivo .env (se existir) antes de qualquer outro módulo usar process.env
const envFile = path.resolve(import.meta.dirname, '..', '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const { default: express } = await import('express');
const { default: multer } = await import('multer');
const { db, q, tx, ROOT, DOCS_DIR, MEDIA_DIR, getSettings, cleanupExpired, DEFAULT_SETTINGS } = await import('./db.js');
const A = await import('./auth.js');
const N = await import('./notify.js');

const app = express();
const PORT = Number(process.env.PORT || 3000);
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
app.disable('x-powered-by');

// ---------- Cabeçalhos de segurança ----------
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(express.json({ limit: '200kb' }));
app.use(A.loadUser);

// Proteção CSRF simples: toda requisição que altera dados precisa vir do nosso JavaScript.
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.get('X-Requested-With') !== 'fetch') {
    return res.status(403).json({ error: 'Requisição inválida.' });
  }
  next();
});

// ---------- Uploads ----------
const DOC_TYPES = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const IMG_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

function makeUpload(dir, types, maxMb) {
  return multer({
    storage: multer.diskStorage({
      destination: dir,
      filename: (_req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + types[file.mimetype]),
    }),
    limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (types[file.mimetype]) cb(null, true);
      else cb(Object.assign(new Error('Tipo de arquivo não permitido.'), { status: 400 }));
    },
  });
}
const uploadDoc = makeUpload(DOCS_DIR, DOC_TYPES, 10);
const uploadImg = makeUpload(MEDIA_DIR, IMG_TYPES, 8);

// Confere a assinatura real do arquivo (evita arquivos disfarçados)
function sniffOk(file) {
  const fd = fs.openSync(file.path, 'r');
  const b = Buffer.alloc(12);
  fs.readSync(fd, b, 0, 12, 0);
  fs.closeSync(fd);
  const hex = b.toString('hex');
  switch (file.mimetype) {
    case 'application/pdf': return b.subarray(0, 4).toString() === '%PDF';
    case 'image/jpeg': return hex.startsWith('ffd8ff');
    case 'image/png': return hex.startsWith('89504e47');
    case 'image/gif': return b.subarray(0, 3).toString() === 'GIF';
    case 'image/webp': return b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP';
    default: return false;
  }
}
function checkUploaded(req) {
  if (req.file && !sniffOk(req.file)) {
    fs.rmSync(req.file.path, { force: true });
    throw Object.assign(new Error('O arquivo enviado não é válido.'), { status: 400 });
  }
}
const removeMedia = (src) => {
  if (src && src.startsWith('/uploads/')) fs.rmSync(path.join(MEDIA_DIR, path.basename(src)), { force: true });
};

// ---------- Utilitários ----------
const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const bool = (v) => (v === true || v === 'true' || v === '1' || v === 1 || v === 'on' ? 1 : 0);
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
const isTime = (v) => /^\d{2}:\d{2}$/.test(v || '');
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

function publicUser(u) {
  return {
    id: u.id, role: u.role, name: u.name, email: u.email, whatsapp: u.whatsapp,
    whatsapp_fmt: A.formatWhatsApp(u.whatsapp), notify_email: !!u.notify_email, notify_whatsapp: !!u.notify_whatsapp,
  };
}

function validateContact(body, res) {
  const name = str(body.name, 120);
  const email = A.normalizeEmail(body.email);
  const whatsapp = A.normalizeWhatsApp(body.whatsapp);
  if (name.length < 3) return bad(res, 'Informe o nome completo.'), null;
  if (!A.isEmail(email)) return bad(res, 'Informe um e-mail válido.'), null;
  if (!A.isWhatsApp(whatsapp)) return bad(res, 'Informe um WhatsApp válido com DDD, ex.: (44) 99999-9999.'), null;
  return { name, email, whatsapp };
}

async function sendResetLink(user, { byStaff = false } = {}) {
  const token = A.randomToken();
  q.run('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?,?,?)', A.sha256(token), user.id, Date.now() + 60 * 60 * 1000);
  const area = user.role === 'pai' ? 'pais' : 'equipe';
  const url = `${N.SITE_URL()}/redefinir-senha.html?token=${token}&area=${area}`;
  const s = getSettings();
  if (!N.emailConfigured()) console.log(`[recuperação de senha] Link para ${user.email}: ${url}`);
  return N.notifyUser(user, {
    subject: `Redefinição de senha — ${s.school_name}`,
    title: 'Redefinir sua senha',
    intro: byStaff
      ? `Olá, ${user.name.split(' ')[0]}! A escola gerou um link para você criar uma nova senha de acesso.`
      : `Olá, ${user.name.split(' ')[0]}! Recebemos um pedido para redefinir sua senha. Se não foi você, ignore esta mensagem.`,
    body: 'O link é válido por 1 hora.',
    ctaText: 'Criar nova senha',
    ctaUrl: url,
    whatsappText: `🔐 *${s.school_name}*\n\nOlá, ${user.name.split(' ')[0]}! Use o link abaixo para criar uma nova senha (válido por 1 hora):\n${url}\n\nSe você não pediu, ignore esta mensagem.`,
  });
}

// =====================================================================
// PÚBLICO
// =====================================================================
const PUBLIC_SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);

app.get('/api/public/site', (_req, res) => {
  const s = getSettings();
  const settings = Object.fromEntries(PUBLIC_SETTING_KEYS.map((k) => [k, s[k]]));
  res.json({
    settings,
    segments: q.all('SELECT id, title, age, description, color, icon FROM segments ORDER BY sort, id'),
    gallery: q.all('SELECT id, src, caption FROM gallery ORDER BY sort, id'),
    posts: q.all(`SELECT id, type, title, body, event_date, event_time, image, pinned, created_at FROM posts
                  WHERE visibility = 'publico'
                  ORDER BY pinned DESC, CASE WHEN event_date IS NULL OR event_date >= date('now') THEN 0 ELSE 1 END,
                           COALESCE(event_date, substr(created_at,1,10)) ASC LIMIT 12`),
    types: N.POST_TYPES,
  });
});

// =====================================================================
// AUTENTICAÇÃO
// =====================================================================
app.get('/api/auth/me', (req, res) => res.json({ user: req.user ? publicUser(req.user) : null }));

app.post('/api/auth/register', A.rateLimit('register', 10, 60 * 60 * 1000), async (req, res) => {
  const c = validateContact(req.body, res); if (!c) return;
  const pwErr = A.passwordProblem(req.body.password); if (pwErr) return bad(res, pwErr);
  if (!req.body.consent) return bad(res, 'É preciso aceitar a política de privacidade para se cadastrar.');
  if (q.get('SELECT id FROM users WHERE email = ?', c.email)) return bad(res, 'Este e-mail já está cadastrado. Faça login ou recupere sua senha.', 409);
  const children = Array.isArray(req.body.children) ? req.body.children.slice(0, 8) : [];
  const hash = await A.hashPassword(req.body.password);
  const id = tx(() => {
    const r = q.run(`INSERT INTO users (role, name, email, whatsapp, password_hash, consent_at) VALUES ('pai',?,?,?,?,datetime('now'))`,
      c.name, c.email, c.whatsapp, hash);
    for (const ch of children) {
      const nm = str(ch.name, 120);
      if (nm.length >= 2) q.run('INSERT INTO children (parent_id, name, birth_date, turma) VALUES (?,?,?,?)',
        r.lastInsertRowid, nm, isDate(ch.birth_date) ? ch.birth_date : null, str(ch.turma, 60) || null);
    }
    return Number(r.lastInsertRowid);
  });
  A.createSession(res, id);
  const user = q.get('SELECT * FROM users WHERE id = ?', id);
  const s = getSettings();
  N.notifyUser(user, {
    subject: `Bem-vindo(a) ao portal da ${s.school_name}`,
    title: 'Cadastro realizado com sucesso! 🎉',
    intro: `Olá, ${user.name.split(' ')[0]}! Seu cadastro no portal da família foi concluído.`,
    body: 'A partir de agora você receberá por e-mail e WhatsApp os avisos do mural (feriados, reuniões, eventos) e poderá enviar documentos pela Área dos Pais.',
    ctaText: 'Acessar a Área dos Pais', ctaUrl: `${N.SITE_URL()}/pais.html`,
    whatsappText: `🌈 *${s.school_name}*\n\nOlá, ${user.name.split(' ')[0]}! Seu cadastro no portal da família foi concluído. Você receberá por aqui os avisos da escola. 💜\n\nAcesse: ${N.SITE_URL()}/pais.html`,
  }).catch(() => {});
  res.status(201).json({ user: publicUser(user) });
});

app.post('/api/auth/login', A.rateLimit('login', 12, 15 * 60 * 1000), async (req, res) => {
  const email = A.normalizeEmail(req.body.email);
  const area = req.body.area === 'equipe' ? 'equipe' : 'pais';
  const u = q.get('SELECT * FROM users WHERE email = ?', email);
  const ok = u && (await A.checkPassword(String(req.body.password || ''), u.password_hash));
  if (!ok) return bad(res, 'E-mail ou senha incorretos.', 401);
  if (!u.active) return bad(res, 'Seu acesso está desativado. Fale com a secretaria da escola.', 403);
  const isStaff = A.STAFF.includes(u.role);
  if (area === 'equipe' && !isStaff) return bad(res, 'Este acesso é exclusivo da equipe. Use a Área dos Pais.', 403);
  if (area === 'pais' && isStaff) return bad(res, 'Esta conta é da equipe. Use a Área da Equipe.', 403);
  A.createSession(res, u.id);
  res.json({ user: publicUser(u) });
});

app.post('/api/auth/logout', (req, res) => { A.destroySession(req, res); res.json({ ok: true }); });

app.post('/api/auth/forgot', A.rateLimit('forgot', 6, 60 * 60 * 1000), async (req, res) => {
  const u = q.get('SELECT * FROM users WHERE email = ? AND active = 1', A.normalizeEmail(req.body.email));
  if (u) await sendResetLink(u).catch((e) => console.error(e));
  // Resposta igual sempre, para não revelar quais e-mails existem
  res.json({ ok: true, message: 'Se o e-mail estiver cadastrado, você receberá um link por e-mail e WhatsApp em instantes.' });
});

app.post('/api/auth/reset', A.rateLimit('reset', 15, 60 * 60 * 1000), async (req, res) => {
  const pwErr = A.passwordProblem(req.body.password); if (pwErr) return bad(res, pwErr);
  const row = q.get('SELECT * FROM password_resets WHERE token_hash = ? AND used = 0 AND expires_at > ?', A.sha256(String(req.body.token || '')), Date.now());
  if (!row) return bad(res, 'Link inválido ou expirado. Solicite um novo.');
  const hash = await A.hashPassword(req.body.password);
  tx(() => {
    q.run('UPDATE users SET password_hash = ? WHERE id = ?', hash, row.user_id);
    q.run('UPDATE password_resets SET used = 1 WHERE user_id = ?', row.user_id);
    q.run('DELETE FROM sessions WHERE user_id = ?', row.user_id);
  });
  const u = q.get('SELECT role FROM users WHERE id = ?', row.user_id);
  res.json({ ok: true, area: u?.role === 'pai' ? 'pais' : 'equipe' });
});

// Configuração inicial: cria o primeiro diretor quando ainda não existe nenhum
app.get('/api/auth/setup-status', (_req, res) => {
  res.json({ needsSetup: !q.get("SELECT id FROM users WHERE role = 'diretor' LIMIT 1"), requiresKey: Boolean(process.env.SETUP_KEY) });
});
app.post('/api/auth/setup', A.rateLimit('setup', 10, 60 * 60 * 1000), async (req, res) => {
  if (q.get("SELECT id FROM users WHERE role = 'diretor' LIMIT 1")) return bad(res, 'A configuração inicial já foi feita.', 409);
  if (process.env.SETUP_KEY && req.body.setup_key !== process.env.SETUP_KEY) return bad(res, 'Chave de configuração incorreta.', 403);
  const c = validateContact(req.body, res); if (!c) return;
  const pwErr = A.passwordProblem(req.body.password); if (pwErr) return bad(res, pwErr);
  if (q.get('SELECT id FROM users WHERE email = ?', c.email)) return bad(res, 'Este e-mail já está em uso.', 409);
  const r = q.run(`INSERT INTO users (role, name, email, whatsapp, password_hash) VALUES ('diretor',?,?,?,?)`, c.name, c.email, c.whatsapp, await A.hashPassword(req.body.password));
  A.createSession(res, Number(r.lastInsertRowid));
  res.status(201).json({ user: publicUser(q.get('SELECT * FROM users WHERE id = ?', r.lastInsertRowid)) });
});

// =====================================================================
// MEUS DADOS (qualquer usuário logado)
// =====================================================================
app.put('/api/me', A.requireRole(), (req, res) => {
  const c = validateContact(req.body, res); if (!c) return;
  const dup = q.get('SELECT id FROM users WHERE email = ? AND id <> ?', c.email, req.user.id);
  if (dup) return bad(res, 'Este e-mail já está em uso por outra conta.', 409);
  q.run('UPDATE users SET name = ?, email = ?, whatsapp = ?, notify_email = ?, notify_whatsapp = ? WHERE id = ?',
    c.name, c.email, c.whatsapp, bool(req.body.notify_email), bool(req.body.notify_whatsapp), req.user.id);
  res.json({ user: publicUser(q.get('SELECT * FROM users WHERE id = ?', req.user.id)) });
});

app.put('/api/me/password', A.requireRole(), A.rateLimit('chpw', 10, 15 * 60 * 1000), async (req, res) => {
  const u = q.get('SELECT * FROM users WHERE id = ?', req.user.id);
  if (!(await A.checkPassword(String(req.body.current || ''), u.password_hash))) return bad(res, 'Senha atual incorreta.');
  const pwErr = A.passwordProblem(req.body.password); if (pwErr) return bad(res, pwErr);
  q.run('UPDATE users SET password_hash = ? WHERE id = ?', await A.hashPassword(req.body.password), u.id);
  res.json({ ok: true });
});

// =====================================================================
// ÁREA DOS PAIS
// =====================================================================
const pai = A.requireRole('pai');

app.get('/api/pais/mural', pai, (_req, res) => {
  res.json({
    posts: q.all(`SELECT id, type, title, body, event_date, event_time, image, pinned, visibility, created_at FROM posts
                  ORDER BY pinned DESC, CASE WHEN event_date IS NULL OR event_date >= date('now') THEN 0 ELSE 1 END,
                           COALESCE(event_date, substr(created_at,1,10)) ASC LIMIT 60`),
    types: N.POST_TYPES,
  });
});

app.get('/api/pais/children', pai, (req, res) => {
  res.json({ children: q.all('SELECT id, name, birth_date, turma, notes FROM children WHERE parent_id = ? ORDER BY id', req.user.id) });
});
app.post('/api/pais/children', pai, (req, res) => {
  const name = str(req.body.name, 120);
  if (name.length < 2) return bad(res, 'Informe o nome da criança.');
  if (q.get('SELECT COUNT(*) n FROM children WHERE parent_id = ?', req.user.id).n >= 8) return bad(res, 'Limite de crianças atingido.');
  q.run('INSERT INTO children (parent_id, name, birth_date, turma, notes) VALUES (?,?,?,?,?)', req.user.id, name,
    isDate(req.body.birth_date) ? req.body.birth_date : null, str(req.body.turma, 60) || null, str(req.body.notes, 1000) || null);
  res.status(201).json({ ok: true });
});
app.put('/api/pais/children/:id', pai, (req, res) => {
  const name = str(req.body.name, 120);
  if (name.length < 2) return bad(res, 'Informe o nome da criança.');
  const r = q.run('UPDATE children SET name = ?, birth_date = ?, turma = ?, notes = ? WHERE id = ? AND parent_id = ?', name,
    isDate(req.body.birth_date) ? req.body.birth_date : null, str(req.body.turma, 60) || null, str(req.body.notes, 1000) || null, Number(req.params.id), req.user.id);
  if (!r.changes) return bad(res, 'Criança não encontrada.', 404);
  res.json({ ok: true });
});
app.delete('/api/pais/children/:id', pai, (req, res) => {
  q.run('DELETE FROM children WHERE id = ? AND parent_id = ?', Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

const DOC_CATEGORIES = ['Certidão de nascimento', 'RG/CPF do responsável', 'RG/CPF da criança', 'Comprovante de residência', 'Carteira de vacinação', 'Cartão SUS', 'Laudo / atestado médico', 'Declaração de transferência', 'Contrato / ficha de matrícula', 'Outro'];

app.get('/api/pais/documents', pai, (req, res) => {
  res.json({
    categories: DOC_CATEGORIES,
    documents: q.all(`SELECT d.id, d.title, d.category, d.original_name, d.mime, d.size, d.status, d.feedback, d.created_at, d.child_id, c.name AS child_name
                        FROM documents d LEFT JOIN children c ON c.id = d.child_id WHERE d.parent_id = ? ORDER BY d.id DESC`, req.user.id),
  });
});

app.post('/api/pais/documents', pai, uploadDoc.single('file'), (req, res) => {
  if (!req.file) return bad(res, 'Selecione um arquivo (PDF, JPG, PNG ou WEBP, até 10 MB).');
  checkUploaded(req);
  const category = DOC_CATEGORIES.includes(req.body.category) ? req.body.category : 'Outro';
  const title = str(req.body.title, 120) || category;
  let childId = Number(req.body.child_id) || null;
  if (childId && !q.get('SELECT id FROM children WHERE id = ? AND parent_id = ?', childId, req.user.id)) childId = null;
  q.run('INSERT INTO documents (parent_id, child_id, title, category, filename, original_name, mime, size) VALUES (?,?,?,?,?,?,?,?)',
    req.user.id, childId, title, category, req.file.filename, str(req.file.originalname, 200), req.file.mimetype, req.file.size);
  res.status(201).json({ ok: true });
});

app.delete('/api/pais/documents/:id', pai, (req, res) => {
  const d = q.get('SELECT * FROM documents WHERE id = ? AND parent_id = ?', Number(req.params.id), req.user.id);
  if (!d) return bad(res, 'Documento não encontrado.', 404);
  if (d.status === 'aprovado') return bad(res, 'Documentos aprovados não podem ser excluídos. Fale com a secretaria.');
  q.run('DELETE FROM documents WHERE id = ?', d.id);
  fs.rmSync(path.join(DOCS_DIR, d.filename), { force: true });
  res.json({ ok: true });
});

// Download/visualização protegida (dono do documento ou equipe)
app.get('/api/documents/:id/file', A.requireRole(), (req, res) => {
  const d = q.get('SELECT * FROM documents WHERE id = ?', Number(req.params.id));
  if (!d || (req.user.role === 'pai' && d.parent_id !== req.user.id)) return bad(res, 'Documento não encontrado.', 404);
  const disp = req.query.download ? 'attachment' : 'inline';
  res.setHeader('Content-Type', d.mime);
  res.setHeader('Content-Disposition', `${disp}; filename*=UTF-8''${encodeURIComponent(d.original_name)}`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
  res.sendFile(path.join(DOCS_DIR, d.filename));
});

// =====================================================================
// ÁREA DA EQUIPE
// =====================================================================
const staff = A.requireRole('professor', 'diretor');
const diretor = A.requireRole('diretor');

app.get('/api/admin/stats', staff, (_req, res) => {
  res.json({
    parents: q.get("SELECT COUNT(*) n FROM users WHERE role = 'pai'").n,
    children: q.get('SELECT COUNT(*) n FROM children').n,
    pendingDocs: q.get("SELECT COUNT(*) n FROM documents WHERE status = 'enviado'").n,
    posts: q.get('SELECT COUNT(*) n FROM posts').n,
    upcoming: q.all("SELECT id, type, title, event_date, event_time FROM posts WHERE event_date >= date('now') ORDER BY event_date LIMIT 5"),
    channels: { email: N.emailConfigured(), whatsapp: N.whatsappProvider() },
  });
});

// ----- Mural -----
app.get('/api/admin/posts', staff, (_req, res) => {
  res.json({
    types: N.POST_TYPES,
    posts: q.all(`SELECT p.*, u.name AS author_name,
                    (SELECT COUNT(*) FROM notifications n WHERE n.post_id = p.id AND n.status = 'enviado') AS sent_count
                    FROM posts p LEFT JOIN users u ON u.id = p.author_id
                   ORDER BY p.pinned DESC, p.created_at DESC`),
  });
});

function readPost(req, res) {
  const title = str(req.body.title, 140);
  if (title.length < 3) return bad(res, 'Informe um título.'), null;
  return {
    type: N.POST_TYPES[req.body.type] ? req.body.type : 'aviso',
    title,
    body: str(req.body.body, 5000),
    event_date: isDate(req.body.event_date) ? req.body.event_date : null,
    event_time: isTime(req.body.event_time) ? req.body.event_time : null,
    pinned: bool(req.body.pinned),
    visibility: req.body.visibility === 'pais' ? 'pais' : 'publico',
  };
}

app.post('/api/admin/posts', staff, uploadImg.single('image'), (req, res) => {
  checkUploaded(req);
  const p = readPost(req, res); if (!p) { if (req.file) fs.rmSync(req.file.path, { force: true }); return; }
  const image = req.file ? `/uploads/${req.file.filename}` : null;
  const r = q.run('INSERT INTO posts (type, title, body, event_date, event_time, image, pinned, visibility, author_id) VALUES (?,?,?,?,?,?,?,?,?)',
    p.type, p.title, p.body, p.event_date, p.event_time, image, p.pinned, p.visibility, req.user.id);
  const post = q.get('SELECT * FROM posts WHERE id = ?', r.lastInsertRowid);
  const notified = bool(req.body.notify) ? N.notifyParentsAboutPost(post) : 0;
  res.status(201).json({ post, notified });
});

app.put('/api/admin/posts/:id', staff, uploadImg.single('image'), (req, res) => {
  checkUploaded(req);
  const old = q.get('SELECT * FROM posts WHERE id = ?', Number(req.params.id));
  if (!old) return bad(res, 'Publicação não encontrada.', 404);
  const p = readPost(req, res); if (!p) return;
  let image = old.image;
  if (req.file) { removeMedia(old.image); image = `/uploads/${req.file.filename}`; }
  else if (bool(req.body.remove_image)) { removeMedia(old.image); image = null; }
  q.run(`UPDATE posts SET type=?, title=?, body=?, event_date=?, event_time=?, image=?, pinned=?, visibility=?, updated_at=datetime('now') WHERE id = ?`,
    p.type, p.title, p.body, p.event_date, p.event_time, image, p.pinned, p.visibility, old.id);
  const post = q.get('SELECT * FROM posts WHERE id = ?', old.id);
  const notified = bool(req.body.notify) ? N.notifyParentsAboutPost(post) : 0;
  res.json({ post, notified });
});

app.delete('/api/admin/posts/:id', staff, (req, res) => {
  const old = q.get('SELECT * FROM posts WHERE id = ?', Number(req.params.id));
  if (old) { q.run('DELETE FROM posts WHERE id = ?', old.id); removeMedia(old.image); }
  res.json({ ok: true });
});

app.post('/api/admin/posts/:id/notify', staff, (req, res) => {
  const post = q.get('SELECT * FROM posts WHERE id = ?', Number(req.params.id));
  if (!post) return bad(res, 'Publicação não encontrada.', 404);
  res.json({ notified: N.notifyParentsAboutPost(post) });
});

// Lista para envio manual pelo WhatsApp (quando não há API configurada)
app.get('/api/admin/posts/:id/manual', staff, (req, res) => {
  const post = q.get('SELECT * FROM posts WHERE id = ?', Number(req.params.id));
  if (!post) return bad(res, 'Publicação não encontrada.', 404);
  const s = getSettings();
  const label = N.POST_TYPES[post.type] || 'Aviso';
  const [y, m, d] = (post.event_date || '').split('-');
  const when = post.event_date ? `\n🗓️ ${d}/${m}/${y}${post.event_time ? ` às ${post.event_time}` : ''}` : '';
  const message = `📢 *${s.school_name}*\n\n*${label}: ${post.title}*${when}\n\n${post.body}\n\n👉 ${N.SITE_URL()}/pais.html#mural`;
  res.json({
    message,
    parents: q.all("SELECT id, name, whatsapp FROM users WHERE role = 'pai' AND active = 1 AND notify_whatsapp = 1 ORDER BY name")
      .map((p) => ({ ...p, whatsapp_fmt: A.formatWhatsApp(p.whatsapp) })),
  });
});

// ----- Conteúdo do site -----
app.get('/api/admin/settings', staff, (_req, res) => res.json({ settings: getSettings() }));

app.put('/api/admin/settings', diretor, (req, res) => {
  const upd = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  tx(() => {
    for (const k of PUBLIC_SETTING_KEYS) {
      if (req.body[k] === undefined) continue;
      let v = str(req.body[k], k === 'about_text' ? 5000 : 600);
      if (k === 'whatsapp') v = A.normalizeWhatsApp(v);
      if (k === 'instagram') v = v.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');
      if (k === 'tour_url' && v && !/^https:\/\//.test(v)) continue;
      upd.run(k, v);
    }
  });
  let notified = 0;
  if (bool(req.body.notify)) {
    const r = q.run(`INSERT INTO posts (type, title, body, visibility, author_id) VALUES ('atualizacao', ?, ?, 'pais', ?)`,
      str(req.body.notify_title, 140) || 'O site da escola foi atualizado',
      str(req.body.notify_body, 2000) || 'Publicamos novidades no site da escola. Confira!', req.user.id);
    notified = N.notifyParentsAboutPost(q.get('SELECT * FROM posts WHERE id = ?', r.lastInsertRowid));
  }
  res.json({ settings: getSettings(), notified });
});

// ----- Segmentos -----
app.get('/api/admin/segments', staff, (_req, res) => res.json({ segments: q.all('SELECT * FROM segments ORDER BY sort, id') }));
const COLORS = ['purple', 'green', 'orange', 'blue', 'red', 'yellow'];
function readSegment(req, res) {
  const title = str(req.body.title, 80);
  if (title.length < 2) return bad(res, 'Informe o nome do segmento.'), null;
  return [title, str(req.body.age, 60), str(req.body.description, 600), COLORS.includes(req.body.color) ? req.body.color : 'purple', str(req.body.icon, 8) || '🧸', Number(req.body.sort) || 0];
}
app.post('/api/admin/segments', diretor, (req, res) => {
  const s = readSegment(req, res); if (!s) return;
  q.run('INSERT INTO segments (title, age, description, color, icon, sort) VALUES (?,?,?,?,?,?)', ...s);
  res.status(201).json({ ok: true });
});
app.put('/api/admin/segments/:id', diretor, (req, res) => {
  const s = readSegment(req, res); if (!s) return;
  q.run('UPDATE segments SET title=?, age=?, description=?, color=?, icon=?, sort=? WHERE id = ?', ...s, Number(req.params.id));
  res.json({ ok: true });
});
app.delete('/api/admin/segments/:id', diretor, (req, res) => { q.run('DELETE FROM segments WHERE id = ?', Number(req.params.id)); res.json({ ok: true }); });

// ----- Galeria -----
app.get('/api/admin/gallery', staff, (_req, res) => res.json({ gallery: q.all('SELECT * FROM gallery ORDER BY sort, id') }));
app.post('/api/admin/gallery', staff, uploadImg.single('image'), (req, res) => {
  if (!req.file) return bad(res, 'Selecione uma imagem (JPG, PNG, WEBP ou GIF, até 8 MB).');
  checkUploaded(req);
  const sort = (q.get('SELECT MAX(sort) m FROM gallery').m || 0) + 1;
  q.run('INSERT INTO gallery (src, caption, sort) VALUES (?,?,?)', `/uploads/${req.file.filename}`, str(req.body.caption, 140), sort);
  res.status(201).json({ ok: true });
});
app.put('/api/admin/gallery/:id', staff, (req, res) => {
  q.run('UPDATE gallery SET caption = ?, sort = ? WHERE id = ?', str(req.body.caption, 140), Number(req.body.sort) || 0, Number(req.params.id));
  res.json({ ok: true });
});
app.delete('/api/admin/gallery/:id', staff, (req, res) => {
  const g = q.get('SELECT * FROM gallery WHERE id = ?', Number(req.params.id));
  if (g) { q.run('DELETE FROM gallery WHERE id = ?', g.id); removeMedia(g.src); }
  res.json({ ok: true });
});

// ----- Famílias, alunos e documentos -----
app.get('/api/admin/parents', staff, (_req, res) => {
  const parents = q.all(`SELECT u.id, u.name, u.email, u.whatsapp, u.active, u.notify_email, u.notify_whatsapp, u.created_at, u.last_login_at,
        (SELECT COUNT(*) FROM documents d WHERE d.parent_id = u.id) AS docs,
        (SELECT COUNT(*) FROM documents d WHERE d.parent_id = u.id AND d.status = 'enviado') AS pending
      FROM users u WHERE u.role = 'pai' ORDER BY u.name`);
  const kids = q.all('SELECT id, parent_id, name, birth_date, turma, notes FROM children ORDER BY name');
  for (const p of parents) {
    p.whatsapp_fmt = A.formatWhatsApp(p.whatsapp);
    p.children = kids.filter((k) => k.parent_id === p.id);
  }
  res.json({ parents });
});

app.get('/api/admin/parents.csv', diretor, (_req, res) => {
  const rows = q.all(`SELECT u.name, u.email, u.whatsapp, u.created_at, GROUP_CONCAT(c.name || COALESCE(' (' || c.turma || ')', ''), '; ') AS criancas
                        FROM users u LEFT JOIN children c ON c.parent_id = u.id WHERE u.role = 'pai' GROUP BY u.id ORDER BY u.name`);
  const cell = (v) => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
  const csv = '﻿Nome;E-mail;WhatsApp;Cadastro;Crianças\n' + rows.map((r) => [r.name, r.email, A.formatWhatsApp(r.whatsapp), r.created_at, r.criancas].map(cell).join(';')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="familias-arca-de-noe.csv"');
  res.send(csv);
});

app.put('/api/admin/parents/:id/active', diretor, (req, res) => {
  const id = Number(req.params.id);
  q.run("UPDATE users SET active = ? WHERE id = ? AND role = 'pai'", bool(req.body.active), id);
  if (!bool(req.body.active)) q.run('DELETE FROM sessions WHERE user_id = ?', id);
  res.json({ ok: true });
});

app.delete('/api/admin/users/:id', diretor, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return bad(res, 'Você não pode excluir a sua própria conta.');
  const u = q.get('SELECT * FROM users WHERE id = ?', id);
  if (!u) return bad(res, 'Usuário não encontrado.', 404);
  if (u.role === 'diretor' && q.get("SELECT COUNT(*) n FROM users WHERE role = 'diretor'").n <= 1) return bad(res, 'É preciso manter ao menos um diretor.');
  for (const d of q.all('SELECT filename FROM documents WHERE parent_id = ?', id)) fs.rmSync(path.join(DOCS_DIR, d.filename), { force: true });
  q.run('DELETE FROM users WHERE id = ?', id);
  res.json({ ok: true });
});

app.post('/api/admin/users/:id/reset-password', diretor, async (req, res) => {
  const u = q.get('SELECT * FROM users WHERE id = ?', Number(req.params.id));
  if (!u) return bad(res, 'Usuário não encontrado.', 404);
  const r = await sendResetLink(u, { byStaff: true });
  res.json({ ok: true, result: r });
});

app.get('/api/admin/documents', staff, (req, res) => {
  const status = ['enviado', 'aprovado', 'recusado'].includes(req.query.status) ? req.query.status : null;
  res.json({
    documents: q.all(`SELECT d.id, d.title, d.category, d.original_name, d.mime, d.size, d.status, d.feedback, d.created_at,
                             u.id AS parent_id, u.name AS parent_name, c.name AS child_name
                        FROM documents d JOIN users u ON u.id = d.parent_id LEFT JOIN children c ON c.id = d.child_id
                       ${status ? 'WHERE d.status = ?' : ''} ORDER BY d.status = 'enviado' DESC, d.id DESC LIMIT 500`, ...(status ? [status] : [])),
  });
});

app.put('/api/admin/documents/:id', staff, (req, res) => {
  const d = q.get('SELECT * FROM documents WHERE id = ?', Number(req.params.id));
  if (!d) return bad(res, 'Documento não encontrado.', 404);
  const status = ['aprovado', 'recusado', 'enviado'].includes(req.body.status) ? req.body.status : d.status;
  const feedback = str(req.body.feedback, 600) || null;
  if (status === 'recusado' && !feedback) return bad(res, 'Explique ao responsável o motivo da recusa.');
  q.run("UPDATE documents SET status = ?, feedback = ?, reviewed_by = ?, updated_at = datetime('now') WHERE id = ?", status, feedback, req.user.id, d.id);
  const parent = q.get('SELECT * FROM users WHERE id = ?', d.parent_id);
  if (parent && status !== 'enviado') {
    const s = getSettings();
    const label = status === 'aprovado' ? 'aprovado ✅' : 'precisa ser reenviado ⚠️';
    N.notifyUser(
      { ...parent, email: parent.notify_email ? parent.email : null },
      {
        subject: `Documento ${status === 'aprovado' ? 'aprovado' : 'recusado'}: ${d.title}`,
        title: `Seu documento foi ${status}`,
        intro: `Olá, ${parent.name.split(' ')[0]}! O documento “${d.title}” ${label}.`,
        body: feedback ? `Observação da escola: ${feedback}` : '',
        ctaText: 'Ver meus documentos', ctaUrl: `${N.SITE_URL()}/pais.html#documentos`,
        whatsappText: parent.notify_whatsapp ? `📄 *${s.school_name}*\n\nOlá, ${parent.name.split(' ')[0]}! O documento “${d.title}” ${label}.${feedback ? `\nObservação: ${feedback}` : ''}\n\n👉 ${N.SITE_URL()}/pais.html#documentos` : null,
      },
    ).catch(() => {});
  }
  res.json({ ok: true });
});

// ----- Equipe (diretores e professores) -----
app.get('/api/admin/staff', staff, (_req, res) => {
  res.json({
    staff: q.all("SELECT id, role, name, email, whatsapp, active, created_at, last_login_at FROM users WHERE role IN ('professor','diretor') ORDER BY role DESC, name")
      .map((u) => ({ ...u, whatsapp_fmt: A.formatWhatsApp(u.whatsapp) })),
  });
});

app.post('/api/admin/staff', diretor, async (req, res) => {
  const c = validateContact(req.body, res); if (!c) return;
  const role = req.body.role === 'diretor' ? 'diretor' : 'professor';
  if (q.get('SELECT id FROM users WHERE email = ?', c.email)) return bad(res, 'Este e-mail já está cadastrado.', 409);
  // Senha temporária aleatória: o membro da equipe recebe um link para criar a própria senha
  const temp = A.randomToken();
  const r = q.run('INSERT INTO users (role, name, email, whatsapp, password_hash) VALUES (?,?,?,?,?)', role, c.name, c.email, c.whatsapp, await A.hashPassword(temp));
  const user = q.get('SELECT * FROM users WHERE id = ?', r.lastInsertRowid);
  const result = await sendResetLink(user, { byStaff: true });
  res.status(201).json({ ok: true, result });
});

app.put('/api/admin/staff/:id', diretor, (req, res) => {
  const id = Number(req.params.id);
  const u = q.get("SELECT * FROM users WHERE id = ? AND role IN ('professor','diretor')", id);
  if (!u) return bad(res, 'Membro não encontrado.', 404);
  const c = validateContact(req.body, res); if (!c) return;
  const role = req.body.role === 'diretor' ? 'diretor' : 'professor';
  const active = bool(req.body.active);
  if (id === req.user.id && (role !== 'diretor' || !active)) return bad(res, 'Você não pode rebaixar ou desativar a sua própria conta.');
  if (q.get('SELECT id FROM users WHERE email = ? AND id <> ?', c.email, id)) return bad(res, 'Este e-mail já está em uso.', 409);
  q.run('UPDATE users SET name=?, email=?, whatsapp=?, role=?, active=? WHERE id = ?', c.name, c.email, c.whatsapp, role, active, id);
  if (!active) q.run('DELETE FROM sessions WHERE user_id = ?', id);
  res.json({ ok: true });
});

// ----- Notificações -----
app.get('/api/admin/notifications', staff, (_req, res) => {
  res.json({
    channels: { email: N.emailConfigured(), whatsapp: N.whatsappProvider() },
    log: q.all(`SELECT n.*, p.title AS post_title, u.name AS user_name FROM notifications n
                  LEFT JOIN posts p ON p.id = n.post_id LEFT JOIN users u ON u.id = n.user_id
                 ORDER BY n.id DESC LIMIT 200`),
  });
});

app.post('/api/admin/notifications/test', diretor, async (req, res) => {
  const u = q.get('SELECT * FROM users WHERE id = ?', req.user.id);
  const s = getSettings();
  const r = await N.notifyUser(u, {
    subject: `Teste de notificação — ${s.school_name}`,
    title: 'Teste de notificação',
    intro: 'Se você recebeu esta mensagem, o envio de e-mails está funcionando. ✅',
    whatsappText: `✅ *${s.school_name}*\nTeste de notificação por WhatsApp funcionando!`,
  });
  res.json(r);
});

// =====================================================================
// ARQUIVOS ESTÁTICOS
// =====================================================================
app.use('/uploads', express.static(MEDIA_DIR, { maxAge: '7d', index: false, dotfiles: 'deny' }));
app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'], maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));

app.use('/api', (_req, res) => bad(res, 'Rota não encontrada.', 404));
app.use((_req, res) => res.status(404).sendFile(path.join(ROOT, 'public', '404.html')));

// Tratamento de erros (inclui limites de upload)
app.use((err, req, res, _next) => {
  if (req.file?.path) fs.rmSync(req.file.path, { force: true });
  if (err.code === 'LIMIT_FILE_SIZE') return bad(res, 'Arquivo muito grande.');
  if (err.type === 'entity.too.large') return bad(res, 'Conteúdo muito grande.');
  if (err.status && err.status < 500) return bad(res, err.message, err.status);
  console.error(err);
  res.status(500).json({ error: 'Erro interno. Tente novamente.' });
});

// Primeiro diretor via variáveis de ambiente (opcional)
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD && !q.get("SELECT id FROM users WHERE role = 'diretor' LIMIT 1")) {
  const wa = A.normalizeWhatsApp(process.env.ADMIN_WHATSAPP || getSettings().whatsapp);
  q.run(`INSERT OR IGNORE INTO users (role, name, email, whatsapp, password_hash) VALUES ('diretor',?,?,?,?)`,
    process.env.ADMIN_NAME || 'Direção', A.normalizeEmail(process.env.ADMIN_EMAIL), wa, await A.hashPassword(process.env.ADMIN_PASSWORD));
  console.log(`Diretor inicial criado: ${process.env.ADMIN_EMAIL}`);
}

cleanupExpired();
setInterval(cleanupExpired, 60 * 60 * 1000).unref();

app.listen(PORT, () => {
  console.log(`\n🌈 Escola Arca de Noé rodando em http://localhost:${PORT}`);
  console.log(`   E-mail: ${N.emailConfigured() ? 'configurado' : 'NÃO configurado (mensagens aparecem no console)'}`);
  console.log(`   WhatsApp: ${N.whatsappProvider() || 'NÃO configurado (mensagens aparecem no console)'}\n`);
});

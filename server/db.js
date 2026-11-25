// Banco de dados SQLite embutido no Node (node:sqlite) — sem dependências nativas.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
export const DOCS_DIR = path.join(DATA_DIR, 'uploads', 'docs');      // privado (documentos dos pais)
export const MEDIA_DIR = path.join(DATA_DIR, 'uploads', 'public');   // público (imagens do mural/galeria)

fs.mkdirSync(DOCS_DIR, { recursive: true });
fs.mkdirSync(MEDIA_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'arca.db'));

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL CHECK (role IN ('pai','professor','diretor')),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  whatsapp TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  notify_email INTEGER NOT NULL DEFAULT 1,
  notify_whatsapp INTEGER NOT NULL DEFAULT 1,
  consent_at TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS children (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  birth_date TEXT,
  turma TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_id INTEGER REFERENCES children(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado','aprovado','recusado')),
  feedback TEXT,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT 'aviso',
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  event_date TEXT,
  event_time TEXT,
  image TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  visibility TEXT NOT NULL DEFAULT 'publico' CHECK (visibility IN ('publico','pais')),
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  age TEXT,
  description TEXT,
  color TEXT NOT NULL DEFAULT 'purple',
  icon TEXT NOT NULL DEFAULT '🧸',
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS gallery (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  src TEXT NOT NULL,
  caption TEXT,
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_docs_parent ON documents(parent_id);
CREATE INDEX IF NOT EXISTS idx_children_parent ON children(parent_id);
CREATE INDEX IF NOT EXISTS idx_posts_date ON posts(event_date);
CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at);
`);

// ---------- Helpers ----------
export const q = {
  get: (sql, ...p) => db.prepare(sql).get(...p),
  all: (sql, ...p) => db.prepare(sql).all(...p),
  run: (sql, ...p) => db.prepare(sql).run(...p),
};

export function tx(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}

// ---------- Conteúdo inicial (editável na Área da Equipe) ----------
export const DEFAULT_SETTINGS = {
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
};

const insSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insSetting.run(k, v);

if (!q.get('SELECT COUNT(*) AS n FROM segments').n) {
  const s = db.prepare('INSERT INTO segments (title, age, description, color, icon, sort) VALUES (?,?,?,?,?,?)');
  s.run('Berçário', 'Bebês', 'Acolhimento, rotina afetuosa e estímulos sensoriais para os primeiros passos, com equipe atenta a cada necessidade.', 'blue', '🍼', 1);
  s.run('Maternal', '1 a 3 anos', 'Brincadeiras, música e convivência que desenvolvem a linguagem, a autonomia e a coordenação motora.', 'green', '🧸', 2);
  s.run('Pré-escola', '4 e 5 anos', 'Preparação para a alfabetização com projetos, histórias bíblicas, arte e muita descoberta.', 'orange', '🎨', 3);
  s.run('Ensino Fundamental', 'Anos iniciais', 'Base sólida em leitura, escrita e matemática, com formação de valores e acompanhamento próximo das famílias.', 'purple', '📚', 4);
}

if (!q.get('SELECT COUNT(*) AS n FROM gallery').n) {
  const g = db.prepare('INSERT INTO gallery (src, caption, sort) VALUES (?,?,?)');
  g.run('img/fachada.jpg', 'Nossa escola', 1);
  g.run('img/galeria/foto1.jpg', 'Carinho em cada passo', 2);
  g.run('img/galeria/foto4.jpg', 'Colônia de férias', 3);
  g.run('img/galeria/foto8.jpg', 'Parquinho', 4);
  g.run('img/galeria/foto3.jpg', 'Descobertas todos os dias', 5);
}

if (!q.get('SELECT COUNT(*) AS n FROM posts').n) {
  const p = db.prepare('INSERT INTO posts (type, title, body, event_date, event_time, pinned, visibility) VALUES (?,?,?,?,?,?,?)');
  p.run('matricula', 'Matrículas abertas', 'Estamos com matrículas abertas para o próximo ano letivo. Agende uma visita e conheça nossa estrutura! Fale com a secretaria pelo WhatsApp.', null, null, 1, 'publico');
  p.run('feriado', 'Feriado de Natal — não haverá aula', 'Desejamos a todas as famílias um Natal abençoado! A escola estará fechada no feriado.', '2026-12-25', null, 0, 'publico');
  p.run('reuniao', 'Reunião de pais (exemplo)', 'Exemplo de aviso exclusivo para pais cadastrados. Edite ou exclua este item na Área da Equipe.', '2026-12-10', '19:00', 0, 'pais');
}

export function getSettings() {
  const rows = q.all('SELECT key, value FROM settings');
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

// Remove sessões e tokens vencidos de tempos em tempos
export function cleanupExpired() {
  const now = Date.now();
  q.run('DELETE FROM sessions WHERE expires_at < ?', now);
  q.run('DELETE FROM password_resets WHERE expires_at < ? OR used = 1', now);
}

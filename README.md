# 🌈 Escola Arca de Noé · Sarandi-PR

Site institucional e portal da escola, com:

- **Página principal** com a identidade visual da escola (logo, cores do arco-íris, fotos do Instagram), segmentos de ensino, galeria, contato com mapa e botão de WhatsApp.
- **Tour virtual 360°** com o título *“Conheça o lugar onde seu filho vai crescer”*. Abre **dentro do site, em tela cheia**, em um `iframe` com `sandbox` que **bloqueia pop-ups, novas abas e a navegação da página principal**, então o visitante nunca é levado para o domínio do tour.
- **Mural** para feriados, reuniões, eventos, passeios, cardápio e avisos: público ou exclusivo para pais.
- **Área dos Pais** (login com senha): cadastro com **e-mail e WhatsApp obrigatórios**, cadastro das crianças, **envio de documentos** (PDF/JPG/PNG/WEBP) com acompanhamento de status, mural completo e preferências de notificação.
- **Área da Equipe** (login com senha) para **diretores e professores**: publicar no mural, conferir e aprovar documentos, gerenciar famílias, galeria, equipe e o **conteúdo do site** (textos, contatos, URL do tour, segmentos).
- **Recuperação de senha** por link enviado por e-mail e WhatsApp (válido por 1 hora).
- **Notificações automáticas** por **e-mail e WhatsApp** a todas as famílias quando um aviso é publicado ou o site é atualizado, com histórico de envios.

## Perfis de acesso

| Perfil | Pode |
|---|---|
| **Responsável (pai/mãe)** | Ver o mural completo, cadastrar filhos, enviar documentos, editar dados e notificações |
| **Professor(a)** | Publicar no mural e notificar, conferir documentos, ver famílias, gerenciar galeria |
| **Diretor(a)** | Tudo do professor + editar conteúdo do site, segmentos, equipe, ativar/excluir famílias, exportar planilha, enviar links de nova senha |

## Como rodar

Requisitos: **Node.js 22.13 ou superior** (usa o SQLite embutido do Node, sem banco externo).

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm start
```

Acesse `http://localhost:3000`. No **primeiro acesso a `/equipe.html`** aparece a tela de **configuração inicial** para criar a conta da direção. Alternativamente, defina `ADMIN_EMAIL` e `ADMIN_PASSWORD` no `.env`.

> Sem e-mail/WhatsApp configurados, o sistema funciona normalmente e mostra no console as mensagens que seriam enviadas (inclusive links de recuperação de senha).

## Configurar e-mail

Preencha no `.env` os dados SMTP. Exemplo com Gmail (crie uma [senha de app](https://myaccount.google.com/apppasswords)):

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=escola@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
SMTP_FROM="Escola Arca de Noé <escola@gmail.com>"
```

## Configurar WhatsApp

Escolha **um** provedor em `WHATSAPP_PROVIDER`:

| Provedor | Valor | Observação |
|---|---|---|
| [Z-API](https://z-api.io) | `zapi` | Mais simples: conecta o WhatsApp da escola por QR Code |
| Evolution API | `evolution` | Gratuita, auto-hospedada |
| WhatsApp Cloud API (Meta) | `meta` | Oficial; para iniciar conversas exige um **modelo aprovado** (`META_WA_TEMPLATE`) |
| Webhook | `webhook` | Envia `POST {phone, message}` para n8n, Make, Zapier etc. |

Sem provedor configurado, a equipe pode usar o botão **💬 envio manual** em cada publicação do mural: abre o WhatsApp com a mensagem pronta para cada família.

Use **🧪 Enviar teste para mim** em *Notificações* (Área da Equipe) para validar.

## Hospedagem

Qualquer serviço que rode Node.js com **disco persistente** para a pasta `data/` (banco + documentos):

- **Render / Railway**: crie um serviço web com `npm install` e `npm start`, adicione um *volume/disk* e aponte `DATA_DIR` para ele.
- **VPS (Hostinger, DigitalOcean, Contabo…)**: rode com `pm2 start server/index.js --name arca` atrás do Nginx com HTTPS.

Em produção, defina `NODE_ENV=production`, `SITE_URL` (endereço público, usado nos links das mensagens), `TRUST_PROXY=true` e `SETUP_KEY`.

**Backup**: copie a pasta `data/` (contém `arca.db` e os documentos enviados).

## Segurança

- Senhas com **bcrypt**; sessões em cookie `HttpOnly` + `SameSite=Lax` (+ `Secure` em produção).
- Limite de tentativas em login, cadastro e recuperação de senha.
- Proteção contra CSRF (cabeçalho obrigatório nas requisições que alteram dados).
- Documentos ficam **fora da pasta pública** e só são entregues ao próprio responsável ou à equipe; o tipo real do arquivo é verificado no upload.
- Links de redefinição com token aleatório de uso único, armazenado apenas como hash.

## Estrutura

```
server/
  index.js    rotas da API, uploads e servidor
  db.js       banco SQLite e conteúdo inicial
  auth.js     senhas, sessões, validações
  notify.js   e-mail (SMTP) e WhatsApp
public/
  index.html  site principal + tour 360°
  pais.html   Área dos Pais
  equipe.html Área da Equipe
  redefinir-senha.html, privacidade.html, 404.html
  css/ js/ img/
```

## Personalização rápida

Quase tudo é editável pela **Área da Equipe → Conteúdo do site**: títulos, textos, telefone, WhatsApp, Instagram, endereço, mapa, horário e **URL do tour 360°** (o tour atual é um exemplo; troque pelo tour da escola quando estiver pronto).

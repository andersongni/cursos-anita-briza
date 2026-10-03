# Plataforma de Avaliação — Núcleo Assistencial Anita Briza

Plataforma web para aplicação de avaliações do curso de **Informática para Iniciantes**.

Roda **localmente e offline** em desenvolvimento: SQLite (arquivo) + autenticação JWT. Não exige Supabase nem internet após `npm install`.

---

## Rodando localmente em 3 passos

### Pré-requisitos

| Ferramenta | Versão mínima | Download |
|---|---|---|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Git | qualquer | [git-scm.com](https://git-scm.com) |

---

### Passo 1 — Instale as dependências

```bash
git clone https://github.com/seu-usuario/avaliacao-anita-briza.git
cd avaliacao-anita-briza
npm install
```

> Se já baixou o projeto como ZIP, apenas acesse a pasta e rode `npm install`.

---

### Passo 2 — Configure o ambiente e o banco

```bash
# Linux/Mac
cp .env.example .env.local

# Windows (PowerShell)
Copy-Item .env.example .env.local
```

Depois:

```bash
npm run setup
```

Isso cria o SQLite em `prisma/dev.db` **vazio** (sem alunos, perguntas, avaliações ou certificados), aplica as configurações padrão e cria um admin:

| Campo | Valor |
|---|---|
| Usuário | `admin` |
| Senha | `admin123` |

Para importar o banco de perguntas (JSON em `data/questions/`): `npm run seed`.  
Para outro admin (interativo): `npm run create-admin`.

---

### Passo 3 — Inicie o servidor

```bash
npm run dev
```

Acesse: **[http://localhost:3000](http://localhost:3000)**

Faça login com `admin` / `admin123`.

---

## Comandos disponíveis

| Comando | O que faz |
|---|---|
| `npm run setup` | Cria banco zerado + configs + admin |
| `npm run dev` | Inicia o servidor de desenvolvimento |
| `npm run build` | Gera o build de produção |
| `npm run start` | Inicia o servidor de produção (após o build) |
| `npm run seed` | (Opcional) importa perguntas do JSON |
| `npm run seed:settings` | Insere só as configurações padrão |
| `npm run create-admin` | Cria um administrador (interativo) |
| `npm run ensure-admin` | Cria admin padrão se nenhum existir |
| `npm run db:studio` | Abre o Prisma Studio (visualizar o banco) |
| `npm run db:reset` | Recria o banco zerado do zero |
| `npm run lint` | Verifica problemas de código |

---

## Estrutura do projeto

```
avaliacao-anita-briza/
├── data/questions/            # JSON com as 400 perguntas
├── prisma/
│   ├── schema.prisma          # Schema SQLite
│   └── dev.db                 # Banco local (gerado; não versionado)
├── scripts/
│   ├── seed-questions.ts
│   ├── create-admin.ts
│   └── ensure-admin.ts
├── src/
│   ├── app/api/               # Rotas de API (Prisma + JWT)
│   ├── app/admin/             # Painel administrativo
│   ├── app/student/           # Área do aluno
│   ├── components/
│   └── lib/
│       ├── auth/              # Sessão JWT (cookie httpOnly)
│       ├── db.ts              # Cliente Prisma (SQLite/libSQL)
│       └── certificate/       # Geração de PDF
├── .env.example
└── README.md
```

---

## Perfis de usuário

### ADMIN
- Aprovar/bloquear alunos
- Gerenciar perguntas e temas
- Ver todas as avaliações e respostas
- Configurar regras e distribuição de questões
- Liberar nova tentativa de prova
- Gerar e baixar certificados

### STUDENT (aprovado pelo admin)
- Realizar simulados (com revisão e gabarito)
- Realizar provas (correção automática, sem gabarito)
- Ver histórico de avaliações
- Emitir certificado quando aprovado

---

## Segurança

- Senhas com hash bcrypt
- Sessão JWT em cookie httpOnly
- Gabarito da PROVA nunca enviado ao frontend
- Correção feita exclusivamente no servidor
- Cronômetro baseado no servidor (resiste a refresh)

---

## Deploy gratuito (Vercel + Turso)

1. Crie um banco em [turso.tech](https://turso.tech) e gere um token.
2. Na [Vercel](https://vercel.com), importe este repositório e configure:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | `libsql://seu-banco.turso.io` |
| `TURSO_AUTH_TOKEN` | token do Turso |
| `JWT_SECRET` | string longa e aleatória |
| `NEXT_PUBLIC_APP_URL` | URL do projeto na Vercel |

3. **Obrigatório após o deploy:** criar as tabelas no Turso (senão o login falha com `no such table: Profile`):

```powershell
# Cole a mesma URL e token que estão na Vercel (Settings → Environment Variables)
# URL deve começar com libsql:// (não use aspas extras nem espaços)
$env:DATABASE_URL="libsql://SEU-BANCO-ORG.turso.io"
$env:TURSO_AUTH_TOKEN="eyJ..."

npm run db:setup:remote
```

Isso gera o SQL do Prisma, aplica no Turso, cria as configurações, o admin (`admin` / `admin123`) e importa as perguntas.

> `prisma db push` **não** aceita `libsql://` — por isso o script usa o client libSQL.

4. Acesse a URL da Vercel e troque a senha do admin no primeiro login.

> Upload de logo customizado usa disco local e **não persiste** na Vercel; o logo padrão continua funcionando.

---

## Problemas comuns

**Erro ao abrir o SQLite / caminho inválido**
→ Use `DATABASE_URL="file:./prisma/dev.db"` (caminho relativo). Não use path absoluto do Windows com `file:///C:/...`.

**`npm run setup` falhou**
→ Confirme que `npm install` terminou sem erro e que a pasta `prisma/` existe.

**Login não funciona**
→ O login é por **usuário** (não e-mail). Após `npm run setup`, use `admin` / `admin123`.

**Página de layouts sem nome do usuário**
→ Faça logout e login novamente; o perfil vem de `/api/auth/me`.

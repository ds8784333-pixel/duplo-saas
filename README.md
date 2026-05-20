# Duplo SaaS — Plataforma de Revenda de Assinaturas

Plataforma SaaS de revenda inspirada no painel **DuploOdds Revendedor**.
Stack: **Next.js 15 (App Router) · React 19 · Tailwind · shadcn-style UI · Prisma + PostgreSQL · JWT (HttpOnly cookies) · WebSocket (`ws`)**.

## Funcionalidades

| Área | Status |
|---|---|
| Auth (JWT em cookie httpOnly, register/login/me/logout) | ✅ funcional |
| Middleware protegendo rotas `/dashboard/*` | ✅ funcional |
| Schema Prisma completo (8 tabelas) | ✅ funcional |
| Layout dashboard com sidebar (Lucide icons) | ✅ funcional |
| Dashboard com cards de stats (em tempo real via WS) | ✅ funcional (stats vêm da DB) |
| Listagem de Usuários com busca/filtros | ✅ funcional |
| Carteira (histórico + saldo + solicitação de saque) | ✅ funcional |
| Liberar acesso (por dias / 24h grátis) | ✅ funcional |
| Minha revenda (nome/logo da marca) | ✅ funcional |
| Subrevendas (schema suporta hierarquia, UI lista) | ✅ schema, UI básica |
| Webhook Mercado Pago/Asaas | ⚠️ **stub** — assinatura HMAC + parser; não chama API real |
| Anti-compartilhamento (IP tracking) | ⚠️ logs gravam por sessão; sem detecção heurística |
| WebSocket realtime (saldo/eventos) | ✅ server separado + hook |
| CSV export | ⚠️ endpoint placeholder |

## Pré-requisitos

- Node.js ≥ 20
- PostgreSQL ≥ 14 (local ou cloud)
- `npm` ou `pnpm`

## Instalação (passo a passo)

```bash
# 1. Entrar no projeto
cd C:/Users/ds878/Documents/duplo-saas

# 2. Instalar deps
npm install

# 3. Copiar .env e preencher
copy .env.example .env
# Edite .env com sua DATABASE_URL e um JWT_SECRET forte

# 4. Subir o schema na DB
npx prisma migrate dev --name init
npx prisma generate

# 5. (Opcional) seed inicial — cria 1 admin
npx prisma db seed

# 6. Rodar o app
npm run dev
# → http://localhost:3000

# 7. Em outro terminal, rodar o WebSocket server (opcional)
node server/ws.mjs
# → ws://localhost:3001
```

## Variáveis de ambiente

| Variável | Para que serve |
|---|---|
| `DATABASE_URL` | string de conexão PostgreSQL |
| `JWT_SECRET` | segredo HMAC pra assinar tokens (mínimo 32 chars) |
| `MP_ACCESS_TOKEN` | (opcional) Mercado Pago access token quando ligar PIX real |
| `MP_WEBHOOK_SECRET` | (opcional) segredo do webhook MP |
| `WS_PORT` | porta do server WebSocket (default 3001) |
| `NEXT_PUBLIC_WS_URL` | URL pública do WS (ex.: `ws://localhost:3001`) |

## Arquitetura

```
duplo-saas/
├── prisma/
│   └── schema.prisma          ← 8 tabelas, full
├── server/
│   └── ws.mjs                 ← server WebSocket independente
├── src/
│   ├── app/
│   │   ├── (auth)/            ← login / register (públicas)
│   │   ├── (dashboard)/       ← layout com sidebar, rotas protegidas
│   │   │   ├── dashboard/
│   │   │   ├── usuarios/
│   │   │   ├── carteira/
│   │   │   ├── liberar-acesso/
│   │   │   ├── minha-revenda/
│   │   │   └── subrevendas/
│   │   ├── api/               ← REST APIs (App Router route handlers)
│   │   │   ├── auth/{login,register,me,logout}/route.ts
│   │   │   ├── users/route.ts
│   │   │   ├── wallet/route.ts
│   │   │   ├── withdraws/route.ts
│   │   │   ├── access/release/route.ts
│   │   │   ├── webhooks/payment/route.ts
│   │   │   └── dashboard/route.ts
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── page.tsx           ← landing/redirect
│   ├── components/
│   │   ├── ui/                ← shadcn-style primitives (button, card, input...)
│   │   ├── sidebar.tsx
│   │   └── stats-card.tsx
│   ├── hooks/
│   │   └── use-ws.ts          ← cliente WebSocket
│   ├── lib/
│   │   ├── db.ts              ← Prisma client singleton
│   │   ├── auth.ts            ← JWT sign/verify, cookie helpers
│   │   └── utils.ts           ← cn(), formatadores
│   └── middleware.ts          ← gate de /dashboard/*
└── ...
```

## Como ligar pagamento real (Mercado Pago)

1. Crie uma aplicação em https://www.mercadopago.com.br/developers/panel
2. Pegue `Access Token` e `Webhook Secret`, coloque em `.env`.
3. Em `src/app/api/webhooks/payment/route.ts`, substitua o `TODO` por:
   - validação do header `x-signature` com HMAC-SHA256 usando `MP_WEBHOOK_SECRET`
   - chamada GET `https://api.mercadopago.com/v1/payments/{id}` com `Authorization: Bearer $MP_ACCESS_TOKEN`
   - se `status === 'approved'`, chame `wallet.credit(...)` (já existe em `lib/wallet.ts` — stub)
4. Configure a URL do webhook no painel MP apontando para `https://SEU_DOMINIO/api/webhooks/payment`.

## Segurança

- JWT em cookie **HttpOnly + Secure + SameSite=Lax** — não exposto pro JS.
- `middleware.ts` valida o token antes de servir páginas/APIs protegidas.
- Rate limit: **TODO** — recomendo `@upstash/ratelimit` ou middleware com Redis.
- Anti-compartilhamento: tabela `login_logs` grava IP + UA. Heurística (vários IPs em curto tempo) é TODO.

## Próximos passos sugeridos

1. Ligar Mercado Pago de verdade (instruções acima).
2. Adicionar `bcrypt` de fato no hash de senha (atualmente usa `scrypt` do Node, já seguro mas dá pra migrar).
3. Adicionar testes (Vitest/Playwright).
4. Implementar CSV export (basta serializar query do Prisma).
5. Implementar heurística anti-compartilhamento (script Node cron varre `login_logs` por user_id com >N IPs distintos em 24h).
6. Adicionar Sentry/log estruturado.

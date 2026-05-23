// =====================================================================
// CONFIGURACAO DE DOMINIOS — fonte unica da verdade
// ---------------------------------------------------------------------
// Quando trocar de dominio (ex.: comprar duplopro.com e apontar pra Vercel):
//   1. Em producao, defina as env vars no painel da Vercel:
//        - NEXT_PUBLIC_DUPLO_PRO_URL   (URL do app scanner, ex.: https://duplopro.com)
//        - NEXT_PUBLIC_DUPLO_SAAS_URL  (URL deste projeto, ex.: https://admin.duplopro.com)
//      Ou, se for "tudo no mesmo dominio com paths":
//        - NEXT_PUBLIC_DUPLO_PRO_URL   = https://duplopro.com
//        - NEXT_PUBLIC_DUPLO_SAAS_URL  = https://duplopro.com/admin
//
//   2. Adicione o(s) novo(s) origin(s) em DUPLO_PRO_ORIGINS (separados por
//      virgula) pra autorizar o SSO automatico:
//        DUPLO_PRO_ORIGINS=https://duplopro.com,https://www.duplopro.com
//
//   3. Em next.config.mjs, atualize o header frame-ancestors pra incluir
//      o novo dominio do Duplo Pro.
//
//   4. No Duplo Pro (odds repo), atualize site-scanner/app.js — a constante
//      DUPLO_SAAS_URL no topo do arquivo deve apontar pra cá.
// =====================================================================

// Os fallbacks aqui sao usados em desenvolvimento (sem .env) e enquanto o
// dominio custom nao estiver configurado na Vercel.
export const DUPLO_PRO_URL =
  process.env.NEXT_PUBLIC_DUPLO_PRO_URL || "https://odds-sable.vercel.app";

// Dominios custom ja em uso no Duplo Pro. Hard-coded no fallback pra que
// o SSO + iframe funcionem mesmo se as env vars (DUPLO_PRO_ORIGINS,
// FRAME_ANCESTORS_EXTRA) ainda nao tiverem sido setadas no painel da Vercel.
export const DUPLO_PRO_EXTRA_ORIGINS = [
  "https://duplopro.xyz",
  "https://www.duplopro.xyz",
];

export const DUPLO_SAAS_URL =
  process.env.NEXT_PUBLIC_DUPLO_SAAS_URL || "https://duplo-saas.vercel.app";

// Super-admin geral: hierarquia topo. Toda conta MAE (RESELLER) e tratada
// como cliente desse super-admin — precisa estar aprovada (com Subscription
// ativa criada por ele) pra usar o painel.
export const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || "ds8784333@gmail.com").toLowerCase();

export function isSuperAdmin(u: { email?: string | null } | null | undefined): boolean {
  return !!u?.email && u.email.toLowerCase() === SUPER_ADMIN_EMAIL;
}

// Origins autorizados a chamar o SSO automatico (/api/auth/sso-by-email).
// Inclui automaticamente o DUPLO_PRO_URL, os dominios custom hard-coded
// (DUPLO_PRO_EXTRA_ORIGINS) e a lista da env var DUPLO_PRO_ORIGINS.
export function ssoAllowedOrigins(): string[] {
  const fromEnv = (process.env.DUPLO_PRO_ORIGINS || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const all = new Set<string>([DUPLO_PRO_URL, ...DUPLO_PRO_EXTRA_ORIGINS, ...fromEnv]);
  return Array.from(all);
}

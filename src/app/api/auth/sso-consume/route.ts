// SSO-via-redirect: consome um token curto gerado pelo /api/auth/sso-by-email
// e seta o cookie de sessao no contexto first-party do duplo-saas.
//
// Por que este endpoint existe:
// - O fluxo antigo dependia de o cookie ser setado pela resposta de um POST
//   cross-origin (duplopro.xyz fetching duplo-saas.vercel.app). Chrome (e
//   outros browsers com Tracking Protection) descartam silenciosamente esse
//   Set-Cookie em terceiros, mesmo com SameSite=None;Secure.
// - Carregando este endpoint via iframe.src faz a request ser TOP-LEVEL
//   pra origem do duplo-saas — o cookie e first-party e nao e bloqueado.
//
// O token e um JWT signado com TTL curto (60s) emitido pelo proprio
// sso-by-email, entao nao ha caminho pra adulteracao. Mesmo com TTL
// curto, eh single-shot na pratica: depois de consumido, o cookie de
// sessao ja esta setado.

import { NextRequest, NextResponse } from "next/server";
import { verifyToken, setSessionCookie } from "@/lib/auth";
import { DUPLO_SAAS_URL } from "@/lib/config";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") || "";
  const nextParam = req.nextUrl.searchParams.get("next") || "/minha-revenda";

  const claims = await verifyToken(token);
  if (!claims) {
    // Token invalido / expirado — redireciona pra login com sinal claro.
    const loginUrl = new URL("/", DUPLO_SAAS_URL);
    loginUrl.searchParams.set("sso", "expired");
    return NextResponse.redirect(loginUrl.toString(), { status: 302 });
  }

  // Reusa o token recebido como cookie de sessao. Como esse token e
  // emitido pelo proprio backend (mesma chave JWT_SECRET), e perfeitamente
  // valido como token de sessao. O TTL eventual sera o do JWT (que o
  // sso-by-email define em 60s pra esse fluxo — entao o usuario tera uma
  // sessao curta. Pra prolongar, re-emitimos abaixo com 7d).
  // Re-emite um token de sessao "normal" (7 dias) pra dar sessao durada.
  const { signSession } = await import("@/lib/auth");
  const longToken = await signSession({
    sub: claims.sub,
    email: claims.email,
    role: claims.role,
    rid: claims.rid,
  });
  await setSessionCookie(longToken);

  // Whitelist do "next": so paths internos (/...), nunca URLs externas.
  let safeNext = "/minha-revenda";
  if (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")) {
    safeNext = nextParam;
  }
  const dest = new URL(safeNext, DUPLO_SAAS_URL);
  return NextResponse.redirect(dest.toString(), { status: 302 });
}

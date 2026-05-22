import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { DUPLO_PRO_URL } from "@/lib/config";

const COOKIE = "duplo_session";

// Rotas/Prefixos publicos (nao exigem auth).
function isPublicPath(pathname: string) {
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/api/reseller")) return true;     // marca pelo slug
  if (pathname.startsWith("/api/access/status")) return true; // status filha
  if (pathname.startsWith("/api/webhooks")) return true;
  if (pathname === "/" || pathname === "/login" || pathname === "/register") return true;
  if (/\.(svg|png|jpg|ico|webp|gif)$/.test(pathname)) return true;
  // Landing branded /<slug> e /<slug>/cadastro continuam publicas.
  // Como nao da pra distinguir "minha-revenda" de "<slug>" no middleware
  // sem chamar o banco, tratamos rotas com 1 ou 2 segmentos como publicas
  // quando o primeiro segmento NAO bate com paineis protegidos abaixo.
  return false;
}

const PROTECTED_PREFIXES = [
  "/dashboard", "/usuarios", "/carteira", "/subrevendas",
  "/minha-revenda", "/liberar-acesso",
];

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

type Claims = { sub: string; email: string; role: string; rid?: string | null };

async function readClaims(token: string | undefined): Promise<Claims | null> {
  if (!token) return null;
  const s = process.env.JWT_SECRET;
  if (!s) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(s));
    return payload as unknown as Claims;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE)?.value;
  const claims = await readClaims(token);
  const authed = !!claims;
  const isUser = claims?.role === "USER";

  // Conta filha (USER) nunca acessa o painel admin: limpa cookie e manda
  // pro Duplo Pro (login generico — o /r/<slug> precisa do slug da mae,
  // que so esta no banco, fora do alcance do middleware).
  if (isUser && (isProtectedPath(pathname) || pathname === "/login" || pathname === "/register" || pathname === "/")) {
    const res = NextResponse.redirect(`${DUPLO_PRO_URL}/login`);
    res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }

  // Logado em /login ou /register -> dashboard.
  if (authed && (pathname === "/login" || pathname === "/register")) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Rotas protegidas exigem auth.
  if (isProtectedPath(pathname) && !authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // /api/admin/* protegida (apenas com sessao valida e nao-USER).
  if (pathname.startsWith("/api/admin")) {
    if (!authed) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
    if (isUser) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  // Caso geral: publico.
  if (isPublicPath(pathname)) return NextResponse.next();
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };

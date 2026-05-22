import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

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

async function isValid(token: string | undefined) {
  if (!token) return false;
  const s = process.env.JWT_SECRET;
  if (!s) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(s));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE)?.value;
  const authed = await isValid(token);

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

  // /api/admin/* protegida (apenas com sessao valida).
  if (pathname.startsWith("/api/admin") && !authed) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  // Caso geral: publico.
  if (isPublicPath(pathname)) return NextResponse.next();
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };

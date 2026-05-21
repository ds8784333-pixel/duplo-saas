import { NextResponse, type NextRequest } from "next/server";

// Login removido — duplo-saas roda dentro do iframe ADM do Duplo Pro,
// entao todas as rotas sao publicas. Quem acessar /login ou /register
// e redirecionado direto para /minha-revenda (o painel ADM).
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === "/login" || pathname === "/register") {
    const url = req.nextUrl.clone();
    url.pathname = "/minha-revenda";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };

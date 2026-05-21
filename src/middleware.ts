import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC = ["/", "/login", "/register"];
const COOKIE = "duplo_session";

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
  // libera assets/api públicas
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/reseller") || // dados publicos da marca pra landing branded
    pathname.match(/\.(svg|png|jpg|ico|webp|gif)$/)
  ) return NextResponse.next();

  const token = req.cookies.get(COOKIE)?.value;
  const authed = await isValid(token);

  // rotas protegidas
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/api/")) {
    if (!authed) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  // se logado, /login → /dashboard
  if (authed && (pathname === "/login" || pathname === "/register")) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };

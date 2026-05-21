// Auth helpers: hash (scrypt), JWT (jose) e cookie session.
import { SignJWT, jwtVerify } from "jose";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";

const COOKIE = "duplo_session";
const ALG = "HS256";

function secretKey() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET ausente ou < 32 chars");
  return new TextEncoder().encode(s);
}

// ---- Password ----
export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(test, "hex"));
}

// ---- JWT ----
export type SessionClaims = { sub: string; email: string; role: string; rid?: string | null };

export async function signSession(claims: SessionClaims, ttl = "7d") {
  return await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(secretKey());
}

export async function verifyToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: [ALG] });
    return payload as unknown as SessionClaims;
  } catch {
    return null;
  }
}

// ---- Cookie helpers (server-side) ----
export async function setSessionCookie(token: string) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE);
}

export async function getSessionFromCookies(): Promise<SessionClaims | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return await verifyToken(token);
}

export async function getCurrentUser() {
  const s = await getSessionFromCookies();
  if (s) {
    const u = await db.user.findUnique({
      where: { id: s.sub },
      include: { wallet: true, resellerProfile: true },
    });
    if (u) return u;
  }
  // Login removido — quando nao ha sessao, cai no primeiro ADMIN/RESELLER
  // cadastrado pra que paineis (Dashboard, Usuarios, Carteira, etc.) e as
  // APIs internas funcionem dentro do iframe ADM do Duplo Pro.
  return db.user.findFirst({
    where: { OR: [{ role: "ADMIN" }, { role: "RESELLER" }] },
    include: { wallet: true, resellerProfile: true },
    orderBy: { createdAt: "asc" },
  });
}

export const SESSION_COOKIE_NAME = COOKIE;

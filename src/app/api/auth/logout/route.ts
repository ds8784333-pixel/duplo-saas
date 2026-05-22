import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  await clearSessionCookie();
  // Redirect relativo (sem hostname hard-coded). Usa o origin atual.
  const url = new URL("/login", req.nextUrl.origin);
  return NextResponse.redirect(url, { status: 303 });
}

export async function GET(req: NextRequest) {
  return POST(req);
}

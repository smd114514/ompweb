import { NextResponse } from "next/server";
import { ACADEMATE_SESSION_COOKIE } from "@/lib/academate-server";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACADEMATE_SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}

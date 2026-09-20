import { NextResponse } from "next/server";
import { ACADEMATE_SESSION_COOKIE, academateFetch, upstreamError } from "@/lib/academate-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "请求内容不是有效 JSON" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) return NextResponse.json({ message: "请填写邮箱和密码" }, { status: 400 });

  try {
    const upstream = await academateFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }, false);
    if (!upstream.ok) {
      const error = await upstreamError(upstream);
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    const payload = await upstream.json() as { token?: unknown; user?: unknown };
    if (typeof payload.token !== "string" || !payload.token) {
      return NextResponse.json({ message: "AcadMate 登录响应缺少令牌" }, { status: 502 });
    }
    const response = NextResponse.json({ user: payload.user ?? null });
    response.cookies.set(ACADEMATE_SESSION_COOKIE, payload.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    return response;
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "无法连接 AcadMate 后端" }, { status: 502 });
  }
}

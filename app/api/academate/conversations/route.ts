import { NextResponse } from "next/server";
import { academateFetch, upstreamError } from "@/lib/academate-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const upstream = await academateFetch("/api/conversations?surface=research");
    if (!upstream.ok) {
      const error = await upstreamError(upstream);
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(await upstream.json());
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "无法连接 AcadMate 后端" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  let body: { title?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ message: "请求内容不是有效 JSON" }, { status: 400 }); }
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "新研究会话";
  try {
    const upstream = await academateFetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ surface: "research", title: title || "新研究会话" }),
    });
    if (!upstream.ok) {
      const error = await upstreamError(upstream);
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(await upstream.json(), { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "无法连接 AcadMate 后端" }, { status: 502 });
  }
}

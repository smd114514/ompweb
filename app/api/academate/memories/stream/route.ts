import { NextResponse } from "next/server";
import { academateFetch, upstreamError } from "@/lib/academate-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { content?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ message: "请求内容不是有效 JSON" }, { status: 400 }); }
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content || content.length > 1000) return NextResponse.json({ message: "记忆内容需为 1–1000 个字符" }, { status: 400 });
  try {
    const upstream = await academateFetch("/api/agent-memories/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }), signal: request.signal });
    if (!upstream.ok || !upstream.body) {
      const error = await upstreamError(upstream);
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return new NextResponse(upstream.body, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" } });
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    return NextResponse.json({ message: error instanceof Error ? error.message : "无法连接 AcadMate 后端" }, { status: 502 });
  }
}

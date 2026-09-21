import { NextResponse } from "next/server";
import { academateFetch, positiveId, upstreamError } from "@/lib/academate-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = positiveId(rawId);
  if (!id) return NextResponse.json({ message: "无效的会话编号" }, { status: 400 });
  let body: { message?: unknown; upload_id?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ message: "请求内容不是有效 JSON" }, { status: 400 }); }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const uploadId = typeof body.upload_id === "string" ? body.upload_id.trim() : "";
  if (!message) return NextResponse.json({ message: "消息不能为空" }, { status: 400 });

  try {
    const upstream = await academateFetch(`/api/conversations/${id}/messages/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, ...(uploadId ? { upload_id: uploadId } : {}) }),
      signal: request.signal,
    });
    if (!upstream.ok || !upstream.body) {
      const error = await upstreamError(upstream);
      return NextResponse.json({ message: error.message }, { status: error.status || 502 });
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    return NextResponse.json({ message: error instanceof Error ? error.message : "无法连接 AcadMate 后端" }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { academateFetch, upstreamError } from "@/lib/academate-server";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ message: "缺少文档标识" }, { status: 400 });
  try {
    const upstream = await academateFetch("/api/pdf/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ document_id: id }) });
    if (!upstream.ok) {
      const error = await upstreamError(upstream);
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(await upstream.json(), { status: upstream.status });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "无法连接 AcadMate 后端" }, { status: 502 });
  }
}

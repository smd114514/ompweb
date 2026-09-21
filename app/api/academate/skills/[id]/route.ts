import { NextResponse } from "next/server";
import { academateFetch, positiveId, upstreamError } from "@/lib/academate-server";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!positiveId(id)) return NextResponse.json({ message: "无效的 Skill 编号" }, { status: 400 });
  try {
    const upstream = await academateFetch(`/api/skills/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: await request.text() });
    if (!upstream.ok) {
      const error = await upstreamError(upstream);
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(await upstream.json());
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "无法连接 AcadMate 后端" }, { status: 502 });
  }
}

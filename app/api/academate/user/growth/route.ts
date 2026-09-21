import { NextResponse } from "next/server";
import { academateFetch, upstreamError } from "@/lib/academate-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const upstream = await academateFetch("/api/user/growth");
    if (!upstream.ok) {
      const error = await upstreamError(upstream);
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(await upstream.json());
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "无法连接 AcadMate 后端" }, { status: 502 });
  }
}

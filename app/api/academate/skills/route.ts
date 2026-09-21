import { NextResponse } from "next/server";
import { academateFetch, upstreamError } from "@/lib/academate-server";

export const dynamic = "force-dynamic";

async function proxy(method: "GET" | "POST", request?: Request) {
  try {
    const upstream = await academateFetch("/api/skills", {
      method,
      ...(request ? { headers: { "Content-Type": "application/json" }, body: await request.text() } : {}),
    });
    if (!upstream.ok) {
      const error = await upstreamError(upstream);
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(await upstream.json(), { status: method === "POST" ? 201 : 200 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "无法连接 AcadMate 后端" }, { status: 502 });
  }
}

export async function GET() { return proxy("GET"); }
export async function POST(request: Request) { return proxy("POST", request); }

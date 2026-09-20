import { NextResponse } from "next/server";
import { academateFetch, upstreamError } from "@/lib/academate-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const upstream = await academateFetch("/api/user/api-settings");
    if (!upstream.ok) {
      const error = await upstreamError(upstream);
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(await upstream.json());
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "无法连接 AcadMate 后端" }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  let body: Record<string, unknown>;
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    body = value as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "请求内容不是有效 JSON" }, { status: 400 });
  }
  const payload: Record<string, boolean | string> = {};
  if (typeof body.enabled === "boolean") payload.enabled = body.enabled;
  if (typeof body.remove_key === "boolean") payload.remove_key = body.remove_key;
  for (const key of ["base_url", "model", "api_key"] as const) {
    if (body[key] !== undefined) {
      if (typeof body[key] !== "string" || body[key].length > 4_000) {
        return NextResponse.json({ message: `${key} 格式不正确` }, { status: 400 });
      }
      payload[key] = body[key];
    }
  }
  try {
    const upstream = await academateFetch("/api/user/api-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!upstream.ok) {
      const error = await upstreamError(upstream);
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(await upstream.json());
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "无法连接 AcadMate 后端" }, { status: 502 });
  }
}

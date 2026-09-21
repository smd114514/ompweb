import { NextResponse } from "next/server";
import { academateFetch, upstreamError } from "@/lib/academate-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const upstream = await academateFetch("/api/pdf/documents");
    if (!upstream.ok) {
      const error = await upstreamError(upstream);
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    const payload = await upstream.json() as { items?: unknown };
    const items = Array.isArray(payload.items) ? payload.items.map((item) => {
      const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        document_id: record.documentId,
        filename: record.originalName,
        page_count: record.pageCount,
        parse_status: record.parseStatus,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      };
    }) : [];
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "无法连接 AcadMate 后端" }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { academateFetch, upstreamError } from "@/lib/academate-server";

export const dynamic = "force-dynamic";

/** Pass a PDF through to AcadMate's authenticated upload endpoint. The
 * browser never receives the Express JWT; the ompweb session cookie is used
 * only by this same-origin proxy. */
export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ message: "上传内容无效" }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ message: "请选择 PDF 文件" }, { status: 400 });

  try {
    const upstream = await academateFetch("/api/upload/pdf", {
      method: "POST",
      body: formData,
      signal: request.signal,
    });
    if (!upstream.ok) {
      const error = await upstreamError(upstream);
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(await upstream.json());
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    return NextResponse.json({ message: error instanceof Error ? error.message : "PDF 上传失败" }, { status: 502 });
  }
}

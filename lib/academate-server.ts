import { cookies } from "next/headers";

export const ACADEMATE_SESSION_COOKIE = "ompweb-academate-session";
const DEFAULT_ACADEMATE_API_BASE_URL = "http://127.0.0.1:3001";

/** Resolve the Express BFF, never the internal FastAPI service. */
export function academateApiBaseUrl(): string {
  const configured = process.env.ACADEMATE_API_BASE_URL?.trim() || DEFAULT_ACADEMATE_API_BASE_URL;
  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error("ACADEMATE_API_BASE_URL must be an absolute http(s) URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("ACADEMATE_API_BASE_URL must use http or https");
  }
  return parsed.toString().replace(/\/$/, "");
}

export function academateUrl(path: string): string {
  if (!path.startsWith("/")) throw new Error("AcadMate API paths must start with '/'");
  return `${academateApiBaseUrl()}${path}`;
}

export async function academateToken(): Promise<string | null> {
  return (await cookies()).get(ACADEMATE_SESSION_COOKIE)?.value ?? null;
}

export async function academateFetch(path: string, init: RequestInit = {}, requireAuth = true): Promise<Response> {
  const headers = new Headers(init.headers);
  if (requireAuth) {
    const token = await academateToken();
    if (!token) return new Response(JSON.stringify({ message: "请先登录 AcadMate" }), { status: 401, headers: { "Content-Type": "application/json" } });
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(academateUrl(path), { ...init, headers, cache: "no-store" });
}

export async function upstreamError(response: Response): Promise<{ message: string; status: number }> {
  const fallback = `AcadMate 请求失败（HTTP ${response.status}）`;
  try {
    const data = await response.json() as { message?: unknown; error?: unknown };
    const message = typeof data.message === "string" ? data.message : typeof data.error === "string" ? data.error : fallback;
    return { message, status: response.status };
  } catch {
    return { message: fallback, status: response.status };
  }
}

export function positiveId(value: string): number | null {
  return /^\d+$/.test(value) && Number(value) > 0 && Number.isSafeInteger(Number(value)) ? Number(value) : null;
}

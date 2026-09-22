"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Brain, LoaderCircle, Send } from "lucide-react";

type AgentMemory = {
  id?: number | string;
  path?: string;
  title?: string;
  content_text?: string;
  memory_type?: string;
  updated_at?: string;
  created_at?: string;
};

async function requestJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({})) as { message?: unknown };
  if (!response.ok) throw new Error(typeof payload.message === "string" ? payload.message : `请求失败（HTTP ${response.status}）`);
  return payload as T;
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const parsed = new Date(value.replace(" ", "T"));
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

async function runMemoryAgent(content: string, onChunk: (text: string) => void): Promise<void> {
  const response = await fetch("/api/academate/memories/stream", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }),
  });
  if (!response.ok || !response.body) {
    const payload = await response.json().catch(() => ({})) as { message?: unknown };
    throw new Error(typeof payload.message === "string" ? payload.message : `记忆智能体请求失败（HTTP ${response.status}）`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let remainder = "";
  for (;;) {
    const { done, value } = await reader.read();
    remainder += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = remainder.split("\n");
    remainder = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line) as { type?: string; message?: string; error?: string };
        if (event.type === "agent_chunk" && typeof event.message === "string") onChunk(event.message);
        if (event.type === "run_completed" && typeof event.message === "string") onChunk(event.message);
        if (event.type === "run_failed" || event.type === "run_cancelled") throw new Error(event.error || event.message || "记忆智能体未能完成");
      } catch (error) {
        if (error instanceof SyntaxError) continue;
        throw error;
      }
    }
    if (done) break;
  }
}

export function AcadMateMemory() {
  const [items, setItems] = useState<AgentMemory[]>([]);
  const [content, setContent] = useState("");
  const [responseText, setResponseText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const payload = await requestJson<{ items?: AgentMemory[] }>("/api/academate/memories");
      setItems(Array.isArray(payload.items) ? payload.items : []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "无法读取智能体记忆"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const addMemory = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || saving) return;
    setSaving(true); setError(null); setResponseText("");
    try {
      await runMemoryAgent(trimmed, (text) => setResponseText((current) => current + text));
      setContent("");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "记忆智能体未能完成"); }
    finally { setSaving(false); }
  };

  return <section style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "clamp(24px, 5vw, 64px)", background: "var(--bg)" }}>
    <div style={{ width: "min(780px, 100%)", margin: "0 auto", display: "grid", gap: 20 }}>
      <header><div style={{ display: "flex", alignItems: "center", gap: 10 }}><Brain size={23} color="var(--accent)" /><h1 className="display-serif" style={{ margin: 0, fontSize: 30 }}>记忆</h1></div><p style={{ margin: "9px 0 0", color: "var(--text-muted)", lineHeight: 1.65 }}>这里由后端的记忆智能体管理。只有你明确要求记住的内容，才会写入跨会话的长期记忆；普通研究对话不会自动写入。</p></header>
      <form onSubmit={addMemory} style={{ display: "grid", gap: 10, padding: 16, border: "1px solid var(--border)", borderRadius: "var(--radius-card)", background: "var(--bg-panel)", boxShadow: "var(--shadow-card)" }}>
        <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 600 }}>交给记忆智能体<textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={1000} rows={3} placeholder="例如：请记住，我的研究主题是……；后续优先关注……" style={{ width: "100%", boxSizing: "border-box", resize: "vertical", padding: "10px 11px", border: "1px solid var(--border)", borderRadius: "var(--radius-control)", background: "var(--bg)", color: "var(--text)", font: "inherit" }} /></label>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}><span style={{ color: "var(--text-muted)", fontSize: 12 }}>{content.length}/1000</span><button type="submit" disabled={!content.trim() || saving} style={{ border: 0, borderRadius: "var(--radius-control)", minHeight: 36, padding: "0 12px", display: "inline-flex", alignItems: "center", gap: 6, background: "var(--accent)", color: "white", font: "inherit", fontWeight: 600, cursor: "pointer" }}>{saving ? <LoaderCircle size={15} className="spin" /> : <Send size={15} />}{saving ? "正在交给智能体" : "请求记住"}</button></div>
      </form>
      {responseText && <div aria-live="polite" style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: "var(--radius-card)", background: "var(--bg-panel)", lineHeight: 1.65, whiteSpace: "pre-wrap", fontSize: 13 }}>{responseText}</div>}
      {error && <div role="alert" style={{ padding: "10px 12px", borderRadius: "var(--radius-control)", background: "var(--bg-subtle)", color: "var(--status-error)", fontSize: 13 }}>{error}</div>}
      <div style={{ display: "grid", gap: 10 }}><h2 className="display-serif" style={{ margin: 0, fontSize: 20 }}>智能体已保存的记忆</h2>{loading ? <div style={{ padding: 24, color: "var(--text-muted)", textAlign: "center" }}>正在读取长期记忆…</div> : items.length === 0 ? <div style={{ padding: 30, border: "1px dashed var(--border)", borderRadius: "var(--radius-card)", color: "var(--text-muted)", textAlign: "center" }}>还没有由智能体保存的长期记忆。</div> : items.map((item, index) => <article key={String(item.id || item.path || index)} style={{ display: "flex", gap: 14, padding: "14px 16px", border: "1px solid var(--border)", borderRadius: "var(--radius-card)", background: "var(--bg-panel)" }}><Brain size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} /><div style={{ minWidth: 0, flex: 1 }}><strong style={{ fontSize: 13 }}>{item.title || item.path || "长期记忆"}</strong><div style={{ marginTop: 5, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{item.content_text || "（智能体未返回可显示的摘要）"}</div><div style={{ marginTop: 7, color: "var(--text-muted)", fontSize: 12 }}>{item.memory_type || "长期记忆"} · {formatDate(item.updated_at || item.created_at)}</div></div></article>)}</div>
    </div>
  </section>;
}

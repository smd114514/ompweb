"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Brain, LoaderCircle, Plus, Trash2 } from "lucide-react";

type Memory = {
  id: number;
  content: string;
  source: "user" | "important_event";
  created_at: string;
  updated_at: string;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { message?: unknown };
    throw new Error(typeof payload.message === "string" ? payload.message : `请求失败（HTTP ${response.status}）`);
  }
  return response.json() as Promise<T>;
}

function formatDate(value: string): string {
  const parsed = new Date(value.replace(" ", "T"));
  return Number.isNaN(parsed.valueOf())
    ? value
    : parsed.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function AcadMateMemory() {
  const [items, setItems] = useState<Memory[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await requestJson<Memory[]>("/api/academate/memories"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法读取记忆");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const addMemory = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      const created = await requestJson<Memory>("/api/academate/memories", {
        method: "POST",
        body: JSON.stringify({ content: trimmed }),
      });
      setItems((current) => [created, ...current]);
      setContent("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存记忆失败");
    } finally {
      setSaving(false);
    }
  };

  const deleteMemory = async (item: Memory) => {
    if (deletingId !== null || !window.confirm("删除这条记忆？此操作无法撤销。")) return;
    setDeletingId(item.id);
    setError(null);
    try {
      await requestJson(`/api/academate/memories/${item.id}`, { method: "DELETE" });
      setItems((current) => current.filter((memory) => memory.id !== item.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除记忆失败");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "clamp(24px, 5vw, 64px)", background: "var(--bg)" }}>
      <div style={{ width: "min(780px, 100%)", margin: "0 auto", display: "grid", gap: 20 }}>
        <header>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Brain size={23} color="var(--accent)" /><h1 className="display-serif" style={{ margin: 0, fontSize: 30 }}>记忆</h1></div>
          <p style={{ margin: "9px 0 0", color: "var(--text-muted)", lineHeight: 1.65 }}>这里仅保存你明确要求记住的内容或标记的重要事件。普通研究对话不会自动加入记忆。</p>
        </header>

        <form onSubmit={addMemory} style={{ display: "grid", gap: 10, padding: 16, border: "1px solid var(--border)", borderRadius: "var(--radius-card)", background: "var(--bg-panel)", boxShadow: "var(--shadow-card)" }}>
          <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 600 }}>添加一条要记住的内容
            <textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={1000} rows={3} placeholder="例如：我的研究主题是……；后续优先关注……" style={{ width: "100%", boxSizing: "border-box", resize: "vertical", padding: "10px 11px", border: "1px solid var(--border)", borderRadius: "var(--radius-control)", background: "var(--bg)", color: "var(--text)", font: "inherit" }} />
          </label>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{content.length}/1000</span>
            <button type="submit" disabled={!content.trim() || saving} style={{ border: 0, borderRadius: "var(--radius-control)", minHeight: 36, padding: "0 12px", display: "inline-flex", alignItems: "center", gap: 6, background: "var(--accent)", color: "white", font: "inherit", fontWeight: 600, cursor: "pointer" }}>{saving ? <LoaderCircle size={15} className="spin" /> : <Plus size={15} />}记住</button>
          </div>
        </form>

        {error && <div role="alert" style={{ padding: "10px 12px", borderRadius: "var(--radius-control)", background: "var(--bg-subtle)", color: "var(--status-error)", fontSize: 13 }}>{error}</div>}

        <div style={{ display: "grid", gap: 10 }}>
          <h2 className="display-serif" style={{ margin: 0, fontSize: 20 }}>已保存的记忆</h2>
          {loading ? <div style={{ padding: 24, color: "var(--text-muted)", textAlign: "center" }}>正在读取记忆…</div> : items.length === 0 ? <div style={{ padding: 30, border: "1px dashed var(--border)", borderRadius: "var(--radius-card)", color: "var(--text-muted)", textAlign: "center" }}>还没有保存任何记忆。</div> : items.map((item) => (
            <article key={item.id} style={{ display: "flex", gap: 14, padding: "14px 16px", border: "1px solid var(--border)", borderRadius: "var(--radius-card)", background: "var(--bg-panel)" }}>
              <Brain size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ minWidth: 0, flex: 1 }}><div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{item.content}</div><div style={{ marginTop: 7, color: "var(--text-muted)", fontSize: 12 }}>{item.source === "important_event" ? "重要事件" : "用户要求记住"} · {formatDate(item.updated_at)}</div></div>
              <button type="button" disabled={deletingId !== null} onClick={() => void deleteMemory(item)} title="删除记忆" aria-label="删除记忆" style={{ width: 32, height: 32, display: "grid", placeItems: "center", flexShrink: 0, padding: 0, border: "1px solid var(--border)", borderRadius: "var(--radius-control)", background: "transparent", color: "var(--text-muted)", cursor: "pointer" }}><Trash2 size={15} /></button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

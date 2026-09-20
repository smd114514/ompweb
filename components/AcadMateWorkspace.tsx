"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, LogOut, MessageSquarePlus, Send, Settings, Sparkles } from "lucide-react";
import { MarkdownBody } from "@/components/MarkdownBody";

type ConversationSummary = {
  id: number;
  title: string;
  surface: "research" | "search";
  updated_at: string;
};

type ConversationMessage = {
  id: number | string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

type ConversationDetail = ConversationSummary & { messages: ConversationMessage[] };

type StreamEvent = { type?: string; message?: string; error?: string };
type LlmSettings = { enabled: boolean; base_url: string; model: string; api_key_saved: boolean };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { message?: unknown };
    throw new Error(typeof payload.message === "string" ? payload.message : `请求失败（HTTP ${response.status}）`);
  }
  return response.json() as Promise<T>;
}

function formatDate(value: string): string {
  const parsed = new Date(value.replace(" ", "T"));
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function AcadMateWorkspace() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [active, setActive] = useState<ConversationDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [llmSettings, setLlmSettings] = useState<LlmSettings | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");

  const loadConversation = useCallback(async (id: number) => {
    const detail = await requestJson<ConversationDetail>(`/api/academate/conversations/${id}`);
    setActive(detail);
    return detail;
  }, []);

  const loadConversations = useCallback(async (selectFirst: boolean) => {
    const rows = await requestJson<ConversationSummary[]>("/api/academate/conversations");
    setConversations(rows);
    setAuthenticated(true);
    const activeStillExists = active && rows.some((item) => item.id === active.id);
    if (selectFirst && rows.length > 0 && !activeStillExists) await loadConversation(rows[0].id);
  }, [active, loadConversation]);

  const loadSettings = useCallback(async () => {
    const settings = await requestJson<LlmSettings>("/api/academate/settings");
    setLlmSettings(settings);
    setBaseUrl(settings.base_url || "");
    setModel(settings.model || "");
  }, []);

  useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        await loadConversations(true);
        await loadSettings();
      } catch (cause) {
        if (disposed) return;
        const message = cause instanceof Error ? cause.message : "无法连接 AcadMate 后端";
        if (message === "请先登录 AcadMate") setAuthenticated(false);
        else {
          setAuthenticated(false);
          setError(message);
        }
      } finally {
        if (!disposed) setLoading(false);
      }
    })();
    return () => { disposed = true; };
  }, [loadConversations, loadSettings]);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await requestJson("/api/academate/login", { method: "POST", body: JSON.stringify({ email, password }) });
      setPassword("");
      setAuthenticated(true);
      await loadConversations(true);
      await loadSettings();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  };

  const createConversation = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const created = await requestJson<ConversationDetail>("/api/academate/conversations", {
        method: "POST",
        body: JSON.stringify({ title: "新研究会话" }),
      });
      setConversations((items) => [created, ...items]);
      setActive(created);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法创建研究会话");
    } finally {
      setSubmitting(false);
    }
  };

  const selectConversation = async (id: number) => {
    if (id === active?.id || submitting) return;
    setLoading(true);
    setError(null);
    try { await loadConversation(id); } catch (cause) { setError(cause instanceof Error ? cause.message : "无法读取会话"); } finally { setLoading(false); }
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || !active || submitting) return;
    setDraft("");
    setSubmitting(true);
    setStreaming("");
    setError(null);
    setActive((current) => current ? { ...current, messages: [...current.messages, { id: `pending-${Date.now()}`, role: "user", content: message }] } : current);
    try {
      const response = await fetch(`/api/academate/conversations/${active.id}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({})) as { message?: unknown };
        throw new Error(typeof payload.message === "string" ? payload.message : "无法发起研究对话");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let remainder = "";
      const consume = (line: string) => {
        if (!line.trim()) return;
        let eventData: StreamEvent;
        try { eventData = JSON.parse(line) as StreamEvent; } catch { return; }
        if (eventData.type === "agent_chunk" && eventData.message) setStreaming((text) => text + eventData.message);
        if (eventData.type === "run_completed" && eventData.message) setStreaming(eventData.message);
        if ((eventData.type === "run_failed" || eventData.type === "run_cancelled") && eventData.error) setError(eventData.error);
      };
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        remainder += decoder.decode(chunk.value, { stream: true });
        const lines = remainder.split(/\r?\n/);
        remainder = lines.pop() ?? "";
        lines.forEach(consume);
      }
      remainder += decoder.decode();
      consume(remainder);
      await loadConversation(active.id);
      await loadConversations(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "研究对话失败");
    } finally {
      setStreaming("");
      setSubmitting(false);
    }
  };

  const logout = async () => {
    await fetch("/api/academate/logout", { method: "POST" });
    setAuthenticated(false);
    setConversations([]);
    setActive(null);
    setError(null);
    setLlmSettings(null);
  };

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const saved = await requestJson<LlmSettings>("/api/academate/settings", {
        method: "PUT",
        body: JSON.stringify({ enabled: true, base_url: baseUrl, model, ...(apiKey ? { api_key: apiKey } : {}) }),
      });
      setLlmSettings(saved);
      setApiKey("");
      setSettingsOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "模型设置保存失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && authenticated === null) {
    return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--bg)", color: "var(--text-muted)" }}>正在连接 AcadMate…</main>;
  }

  if (!authenticated) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "var(--bg)", color: "var(--text)" }}>
        <form onSubmit={login} style={{ width: "min(420px, 100%)", padding: 28, border: "1px solid var(--border)", borderRadius: "var(--radius-modal)", background: "var(--bg-panel)", boxShadow: "var(--shadow-card)", display: "grid", gap: 16 }}>
          <div>
            <div className="display-serif" style={{ fontSize: 28 }}>AcadMate 研究工作台</div>
            <p style={{ margin: "8px 0 0", color: "var(--text-muted)", lineHeight: 1.6 }}>使用 AcadMate 原有账户登录。首次使用该邮箱会由原后端自动创建账户。</p>
          </div>
          {error && <div role="alert" style={{ padding: "10px 12px", borderRadius: "var(--radius-control)", color: "var(--status-error)", background: "var(--bg-subtle)", fontSize: 13 }}>{error}</div>}
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>邮箱<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} /></label>
          <label style={{ display: "grid", gap: 6, fontSize: 13 }}>密码<input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} /></label>
          <button disabled={submitting} type="submit" style={primaryButtonStyle}>{submitting ? "登录中…" : "登录并进入研究会话"}</button>
          <Link href="/" style={{ color: "var(--text-muted)", textAlign: "center", fontSize: 13 }}>返回 OMP 编程助手</Link>
        </form>
      </main>
    );
  }

  return (
    <main style={{ height: "100vh", display: "flex", background: "var(--bg)", color: "var(--text)", overflow: "hidden" }}>
      <aside style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)", background: "var(--bg-panel)" }}>
        <div style={{ padding: 18, borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}><BookOpen size={18} color="var(--accent)" /><strong className="display-serif" style={{ fontSize: 20 }}>AcadMate</strong></div>
          <div style={{ marginTop: 4, color: "var(--text-muted)", fontSize: 12 }}>研究会话 · Express BFF</div>
        </div>
        <div style={{ padding: 12 }}><button onClick={() => void createConversation()} disabled={submitting} style={{ ...primaryButtonStyle, width: "100%", display: "flex", justifyContent: "center", gap: 7 }}><MessageSquarePlus size={16} />新研究会话</button></div>
        <nav aria-label="研究会话" style={{ overflowY: "auto", padding: "0 8px 12px", flex: 1 }}>
          {conversations.map((item) => <button key={item.id} onClick={() => void selectConversation(item.id)} style={{ width: "100%", textAlign: "left", padding: "10px 11px", border: "none", borderRadius: "var(--radius-control)", background: active?.id === item.id ? "var(--bg-selected)" : "transparent", color: "var(--text)", cursor: "pointer", marginBottom: 3 }}><div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, fontWeight: active?.id === item.id ? 600 : 400 }}>{item.title || "未命名研究会话"}</div><div style={{ marginTop: 4, color: "var(--text-dim)", fontSize: 11 }}>{formatDate(item.updated_at)}</div></button>)}
          {!conversations.length && <div style={{ padding: 14, color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6 }}>尚未创建研究会话。</div>}
        </nav>
        <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "grid", gap: 8 }}><Link href="/" style={{ color: "var(--text-muted)", fontSize: 12 }}>← OMP 编程助手</Link><button onClick={() => void logout()} style={{ ...secondaryButtonStyle, display: "flex", alignItems: "center", gap: 6 }}><LogOut size={14} />退出 AcadMate</button></div>
      </aside>
      <section style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column" }}>
        <header style={{ minHeight: 64, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", borderBottom: "1px solid var(--border)" }}><div><div className="display-serif" style={{ fontSize: 21 }}>{active?.title || "选择或创建一个研究会话"}</div><div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>论文阅读、问题拆解与研究建议</div></div><div style={{ display: "flex", alignItems: "center", gap: 10 }}><button onClick={() => setSettingsOpen((open) => !open)} title="模型 API 设置" style={{ ...secondaryButtonStyle, display: "flex", alignItems: "center", gap: 5, color: llmSettings?.enabled ? "var(--accent)" : "var(--text-muted)" }}><Settings size={14} />模型设置</button><Sparkles size={19} color="var(--accent)" /></div></header>
        {settingsOpen && <form onSubmit={saveSettings} style={{ padding: "14px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-panel)", display: "grid", gridTemplateColumns: "minmax(180px, 1.4fr) minmax(120px, 1fr) minmax(160px, 1.2fr) auto", gap: 10, alignItems: "end" }}><label style={{ display: "grid", gap: 5, fontSize: 12 }}>API 地址<input required value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" style={inputStyle} /></label><label style={{ display: "grid", gap: 5, fontSize: 12 }}>模型名称<input required value={model} onChange={(e) => setModel(e.target.value)} placeholder="模型 ID" style={inputStyle} /></label><label style={{ display: "grid", gap: 5, fontSize: 12 }}>API Key<input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={llmSettings?.api_key_saved ? "已保存；留空则不更换" : "首次设置必填"} required={!llmSettings?.api_key_saved} style={inputStyle} /></label><button disabled={submitting} type="submit" style={primaryButtonStyle}>{submitting ? "保存中…" : "保存并启用"}</button><div style={{ gridColumn: "1 / -1", color: "var(--text-muted)", fontSize: 12 }}>密钥仅经本地 ompweb 代理转交给 AcadMate；AcadMate 后端会加密保存，读取接口不会返回明文。</div></form>}
        {error && <div role="alert" style={{ margin: "12px 24px 0", padding: "10px 12px", borderRadius: "var(--radius-control)", background: "var(--bg-subtle)", color: "var(--status-error)", fontSize: 13 }}>{error}</div>}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "24px max(24px, calc((100% - 860px) / 2))" }}>
          {active ? <div style={{ display: "grid", gap: 18 }}>{active.messages.map((item) => <article key={item.id} style={{ alignSelf: item.role === "user" ? "end" : "stretch", maxWidth: item.role === "user" ? "80%" : "100%", padding: item.role === "user" ? "11px 14px" : 0, borderRadius: "var(--radius-card)", background: item.role === "user" ? "var(--user-bg)" : "transparent" }}>{item.role === "assistant" ? <MarkdownBody>{item.content}</MarkdownBody> : <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{item.content}</div>}</article>)}{streaming && <article aria-live="polite"><MarkdownBody isStreaming>{streaming}</MarkdownBody><span style={{ color: "var(--accent)", fontSize: 13 }}>正在研究…</span></article>}</div> : <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--text-muted)", textAlign: "center" }}>从左侧新建一个研究会话，开始与 AcadMate 后端协作。</div>}
        </div>
        <form onSubmit={sendMessage} style={{ padding: "12px 24px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 10 }}><textarea disabled={!active || submitting} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={active ? "输入研究问题，例如：帮我梳理这篇论文的方法与局限" : "请先创建研究会话"} rows={2} style={{ ...inputStyle, resize: "vertical", flex: 1, minHeight: 48 }} /><button disabled={!active || !draft.trim() || submitting} type="submit" title="发送研究问题" style={{ ...primaryButtonStyle, width: 48, padding: 0, display: "grid", placeItems: "center" }}><Send size={18} /></button></form>
      </section>
    </main>
  );
}

const inputStyle = { width: "100%", boxSizing: "border-box" as const, padding: "10px 11px", border: "1px solid var(--border)", borderRadius: "var(--radius-control)", background: "var(--bg)", color: "var(--text)", font: "inherit", outline: "none" };
const primaryButtonStyle = { border: "none", borderRadius: "var(--radius-control)", minHeight: 38, padding: "0 13px", background: "var(--accent)", color: "white", font: "inherit", fontWeight: 600, cursor: "pointer" };
const secondaryButtonStyle = { border: "1px solid var(--border)", borderRadius: "var(--radius-control)", minHeight: 34, padding: "0 10px", background: "transparent", color: "var(--text-muted)", font: "inherit", fontSize: 12, cursor: "pointer" };

"use client";

import { FormEvent, useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Brain, ChevronLeft, ChevronRight, CircleUserRound, Code2, ExternalLink, FileText, Flame, GitFork, LogOut, Mail, Menu, MessageSquarePlus, Orbit, Paperclip, PanelLeft, Send, Settings, Trash2, X } from "lucide-react";
import { AcadMateDocuments } from "@/components/AcadMateDocuments";
import { AcadMateCloud } from "@/components/AcadMateCloud";
import { AcadMateHotTopics } from "@/components/AcadMateHotTopics";
import { AcadMateMemory } from "@/components/AcadMateMemory";
import { AcadMateProfile } from "@/components/AcadMateProfile";
import { AcadMateSkills } from "@/components/AcadMateSkills";
import { MarkdownBody } from "@/components/MarkdownBody";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ALL_THEMES, useTheme, type ThemePreference } from "@/hooks/useTheme";

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
  metadata?: {
    attachment?: { upload_id?: string; filename?: string };
  };
};

type ConversationDetail = ConversationSummary & { messages: ConversationMessage[] };

type StreamEvent = { type?: string; message?: string; error?: string };
type LlmSettings = { enabled: boolean; base_url: string; model: string; api_key_saved: boolean };
type PdfAttachment = { uploadId: string; filename: string };
type EmailSettings = {
  smtp_host: string; smtp_port: number; smtp_secure: boolean; smtp_user: string; smtp_from: string; smtp_password_saved: boolean; remember_smtp_password: boolean;
  imap_host: string; imap_port: number; imap_secure: boolean; imap_user: string; imap_mailbox: string; imap_password_saved: boolean; remember_imap_password: boolean; imap_same_as_smtp: boolean;
};

const SIDEBAR_WIDTH_STORAGE_KEY = "academate:sidebar-width";
const SIDEBAR_DEFAULT_WIDTH = 280;
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 520;

function clampSidebarWidth(width: number): number {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));
}

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

export function AcadMateWorkspace({ children }: { children?: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isProfilePage = pathname === "/academate/profile";
  const isDocumentsPage = pathname === "/academate/files";
  const isMemoryPage = pathname === "/academate/memory";
  const isHotTopicsPage = pathname === "/academate/hot-topics";
  const isCloudPage = pathname === "/academate/cloud";
  const isSkillsPage = pathname === "/academate/skills";
  const isPersonalArea = isProfilePage || isDocumentsPage || isMemoryPage || isHotTopicsPage || isCloudPage || isSkillsPage;
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
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [emailSettingsOpen, setEmailSettingsOpen] = useState(false);
  const [emailSettings, setEmailSettings] = useState<EmailSettings | null>(null);
  const [smtpPassword, setSmtpPassword] = useState("");
  const [imapPassword, setImapPassword] = useState("");
  const [llmSettings, setLlmSettings] = useState<LlmSettings | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [deletingConversationId, setDeletingConversationId] = useState<number | null>(null);
  const [pdfAttachment, setPdfAttachment] = useState<PdfAttachment | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [pdfAgentNotice, setPdfAgentNotice] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === "undefined") return SIDEBAR_DEFAULT_WIDTH;
    const saved = Number(window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
    return Number.isFinite(saved) ? clampSidebarWidth(saved) : SIDEBAR_DEFAULT_WIDTH;
  });
  const [sidebarResizing, setSidebarResizing] = useState(false);
  const [sidebarMenuOpen, setSidebarMenuOpen] = useState(false);
  const [externalLinksMenuOpen, setExternalLinksMenuOpen] = useState(false);
  const sidebarMenuRef = useRef<HTMLDivElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const { preference: themePreference, setTheme } = useTheme();

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => () => resizeCleanupRef.current?.(), []);

  useEffect(() => {
    if (!sidebarMenuOpen && !externalLinksMenuOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!sidebarMenuRef.current?.contains(event.target as Node)) {
        setSidebarMenuOpen(false);
        setExternalLinksMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", closeOnOutside);
    return () => window.removeEventListener("pointerdown", closeOnOutside);
  }, [sidebarMenuOpen, externalLinksMenuOpen]);

  const startSidebarResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    setSidebarResizing(true);
    const move = (moveEvent: PointerEvent) => setSidebarWidth(clampSidebarWidth(startWidth + moveEvent.clientX - startX));
    const end = () => {
      setSidebarResizing(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      resizeCleanupRef.current = null;
    };
    resizeCleanupRef.current?.();
    resizeCleanupRef.current = end;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
  };

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

  const openEmailSettings = async () => {
    setSettingsMenuOpen(false);
    setSidebarMenuOpen(false);
    setSettingsOpen(false);
    setEmailSettingsOpen(true);
    setError(null);
    try {
      setEmailSettings(await requestJson<EmailSettings>("/api/academate/email/settings"));
    } catch (cause) {
      setEmailSettingsOpen(false);
      setError(cause instanceof Error ? cause.message : "无法读取邮件设置");
    }
  };

  const saveEmailSettings = async (event: FormEvent) => {
    event.preventDefault();
    if (!emailSettings) return;
    setSubmitting(true);
    setError(null);
    try {
      const saved = await requestJson<EmailSettings>("/api/academate/email/settings", {
        method: "PUT",
        body: JSON.stringify({
          ...emailSettings,
          ...(smtpPassword ? { smtp_password: smtpPassword } : {}),
          ...(imapPassword && !emailSettings.imap_same_as_smtp ? { imap_password: imapPassword } : {}),
        }),
      });
      setEmailSettings(saved);
      setSmtpPassword("");
      setImapPassword("");
      setEmailSettingsOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "邮件设置保存失败");
    } finally {
      setSubmitting(false);
    }
  };

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
    if (isPersonalArea) router.push("/academate");
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
    if (submitting) return;
    if (isPersonalArea) router.push("/academate");
    if (id === active?.id) return;
    setLoading(true);
    setError(null);
    try { await loadConversation(id); } catch (cause) { setError(cause instanceof Error ? cause.message : "无法读取会话"); } finally { setLoading(false); }
  };

  const deleteConversation = async (conversation: ConversationSummary) => {
    if (submitting || deletingConversationId !== null) return;
    const title = conversation.title || "未命名研究会话";
    if (!window.confirm(`确定永久删除“${title}”吗？此操作无法撤销。`)) return;
    setDeletingConversationId(conversation.id);
    setError(null);
    try {
      await requestJson(`/api/academate/conversations/${conversation.id}`, { method: "DELETE" });
      const remaining = conversations.filter((item) => item.id !== conversation.id);
      setConversations(remaining);
      if (active?.id === conversation.id) {
        if (remaining.length > 0) await loadConversation(remaining[0].id);
        else setActive(null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "删除研究会话失败");
    } finally {
      setDeletingConversationId(null);
    }
  };

  const uploadPdf = async (file: File) => {
    if (!active || submitting) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("请选择 PDF 文件");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("PDF 文件不能超过 20MB");
      return;
    }
    setUploadingPdf(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/academate/uploads/pdf", { method: "POST", body: formData });
      const payload = await response.json().catch(() => ({})) as { upload_id?: unknown; filename?: unknown; message?: unknown };
      if (!response.ok || typeof payload.upload_id !== "string") {
        throw new Error(typeof payload.message === "string" ? payload.message : "PDF 上传失败");
      }
      const attachment = {
        uploadId: payload.upload_id,
        filename: typeof payload.filename === "string" && payload.filename.trim() ? payload.filename : file.name,
      };
      setPdfAttachment(attachment);
      setPdfAgentNotice("已上传，正在提交给文档智能体分析…");
      void fetch(`/api/academate/documents/${encodeURIComponent(attachment.uploadId)}/analyze`, { method: "POST" })
        .then(async (analysisResponse) => {
          const analysis = await analysisResponse.json().catch(() => ({})) as { message?: unknown };
          if (!analysisResponse.ok) throw new Error(typeof analysis.message === "string" ? analysis.message : "文档智能体暂时不可用");
          setPdfAgentNotice("已提交给文档智能体；你仍可立即带着附件开始研究对话。");
        })
        .catch((analysisError: unknown) => setPdfAgentNotice(`附件已上传，但未能启动文档智能体：${analysisError instanceof Error ? analysisError.message : "未知错误"}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PDF 上传失败");
    } finally {
      setUploadingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || !active || submitting || uploadingPdf) return;
    const attachment = pdfAttachment;
    setDraft("");
    setSubmitting(true);
    setStreaming("");
    setError(null);
    setActive((current) => current ? {
      ...current,
      messages: [...current.messages, {
        id: `pending-${Date.now()}`,
        role: "user",
        content: message,
        ...(attachment ? { metadata: { attachment: { upload_id: attachment.uploadId, filename: attachment.filename } } } : {}),
      }],
    } : current);
    try {
      const response = await fetch(`/api/academate/conversations/${active.id}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, ...(attachment ? { upload_id: attachment.uploadId } : {}) }),
      });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({})) as { message?: unknown };
        throw new Error(typeof payload.message === "string" ? payload.message : "无法发起研究对话");
      }
      setPdfAttachment(null);
      setPdfAgentNotice(null);
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
    setPdfAttachment(null);
    setSettingsOpen(false);
    setSettingsMenuOpen(false);
    setEmailSettingsOpen(false);
    setEmailSettings(null);
    setSmtpPassword("");
    setImapPassword("");
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
        </form>
      </main>
    );
  }

  return (
    <main style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)", color: "var(--text)", overflow: "hidden" }}>
      <header style={{ minHeight: 56, flexShrink: 0, display: "flex", alignItems: "center", gap: 4, padding: "0 12px", borderBottom: "1px solid var(--border)", background: "var(--bg-panel)" }}>
        <button type="button" onClick={() => { setSidebarOpen((open) => !open); setSidebarMenuOpen(false); setExternalLinksMenuOpen(false); }} title={sidebarOpen ? "隐藏侧边栏" : "切换侧边栏"} aria-label={sidebarOpen ? "隐藏侧边栏" : "切换侧边栏"} className="shell-toolbar-btn ui-focus-ring"><PanelLeft size={17} strokeWidth={1.8} aria-hidden="true" /></button>
        <button type="button" onClick={() => window.history.back()} title="返回" aria-label="返回" className="shell-toolbar-btn ui-focus-ring"><ChevronLeft size={18} strokeWidth={1.8} aria-hidden="true" /></button>
        <button type="button" onClick={() => window.history.forward()} title="前进" aria-label="前进" className="shell-toolbar-btn ui-focus-ring"><ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" /></button>
      </header>
      <div style={{ minHeight: 0, flex: 1, display: "flex" }}>
      <aside
        aria-hidden={!sidebarOpen}
        style={{
          width: sidebarOpen ? sidebarWidth : 0,
          flexShrink: 0,
          overflow: sidebarMenuOpen || externalLinksMenuOpen ? "visible" : "hidden",
          borderRight: sidebarOpen ? "1px solid var(--border)" : "none",
          background: "var(--bg-panel)",
          transition: sidebarResizing ? "none" : "width var(--dur-med) var(--ease-out-warm)",
        }}
      >
        <div className="academate-sidebar-content" style={{ width: sidebarWidth, height: "100%", display: "flex", flexDirection: "column" }}>
        <div ref={sidebarMenuRef} style={{ position: "relative", padding: 12, borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}><BookOpen size={18} color="var(--accent)" /><strong className="display-serif" style={{ fontSize: 20 }}>AcadMate</strong></div>
          <button
            type="button"
            onClick={() => { setSidebarMenuOpen((open) => !open); setExternalLinksMenuOpen(false); }}
            aria-expanded={sidebarMenuOpen}
            aria-haspopup="menu"
            style={{ ...secondaryButtonStyle, minHeight: 30, width: "100%", marginTop: 8, display: "flex", alignItems: "center", gap: 7, justifyContent: "flex-start" }}
          >
            <Menu size={15} />菜单
          </button>
          <button
            type="button"
            onClick={() => { setSidebarMenuOpen(false); setExternalLinksMenuOpen(false); router.push(isProfilePage ? "/academate" : "/academate/profile"); }}
            aria-current={isProfilePage ? "page" : undefined}
            style={{ ...secondaryButtonStyle, minHeight: 30, width: "100%", marginTop: 4, display: "flex", alignItems: "center", gap: 7, justifyContent: "flex-start", background: isProfilePage ? "var(--bg-selected)" : "transparent", color: isProfilePage ? "var(--text)" : "var(--text-muted)" }}
          >
            <CircleUserRound size={15} />个人中心
          </button>
          <button type="button" onClick={() => { setSidebarMenuOpen(false); setExternalLinksMenuOpen(false); router.push(isMemoryPage ? "/academate" : "/academate/memory"); }} aria-current={isMemoryPage ? "page" : undefined} style={{ ...secondaryButtonStyle, minHeight: 30, width: "100%", marginTop: 4, display: "flex", alignItems: "center", gap: 7, justifyContent: "flex-start", background: isMemoryPage ? "var(--bg-selected)" : "transparent", color: isMemoryPage ? "var(--text)" : "var(--text-muted)" }}><Brain size={15} />记忆</button>
          <button type="button" onClick={() => { setSidebarMenuOpen(false); setExternalLinksMenuOpen(false); router.push(isDocumentsPage ? "/academate" : "/academate/files"); }} aria-current={isDocumentsPage ? "page" : undefined} style={{ ...secondaryButtonStyle, minHeight: 30, width: "100%", marginTop: 4, display: "flex", alignItems: "center", gap: 7, justifyContent: "flex-start", background: isDocumentsPage ? "var(--bg-selected)" : "transparent", color: isDocumentsPage ? "var(--text)" : "var(--text-muted)" }}><FileText size={15} />已导入文件</button>
          <button type="button" onClick={() => { setSidebarMenuOpen(false); setExternalLinksMenuOpen(false); router.push(isCloudPage ? "/academate" : "/academate/cloud"); }} aria-current={isCloudPage ? "page" : undefined} style={{ ...secondaryButtonStyle, minHeight: 30, width: "100%", marginTop: 4, display: "flex", alignItems: "center", gap: 7, justifyContent: "flex-start", background: isCloudPage ? "var(--bg-selected)" : "transparent", color: isCloudPage ? "var(--text)" : "var(--text-muted)" }}><Orbit size={15} />星图</button>
          <button type="button" onClick={() => { setSidebarMenuOpen(false); setExternalLinksMenuOpen(false); router.push(isHotTopicsPage ? "/academate" : "/academate/hot-topics"); }} aria-current={isHotTopicsPage ? "page" : undefined} style={{ ...secondaryButtonStyle, minHeight: 30, width: "100%", marginTop: 4, display: "flex", alignItems: "center", gap: 7, justifyContent: "flex-start", background: isHotTopicsPage ? "var(--bg-selected)" : "transparent", color: isHotTopicsPage ? "var(--text)" : "var(--text-muted)" }}><Flame size={15} />近期热点</button>
          <div style={{ position: "relative", marginTop: 4 }}>
            <button type="button" onClick={() => { setExternalLinksMenuOpen((open) => !open); setSidebarMenuOpen(false); }} aria-expanded={externalLinksMenuOpen} aria-haspopup="menu" style={{ ...secondaryButtonStyle, minHeight: 30, width: "100%", display: "flex", alignItems: "center", gap: 7, justifyContent: "flex-start" }}><ExternalLink size={15} />外部链接</button>
            {externalLinksMenuOpen && <div role="menu" aria-label="外部链接" style={{ position: "absolute", zIndex: 40, top: 0, left: "calc(100% + 8px)", width: 220, padding: 6, display: "grid", gap: 3, background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius-control)", boxShadow: "var(--shadow-pop)" }}>
              <a role="menuitem" href="https://www.zotero.org/" target="_blank" rel="noreferrer" style={{ ...secondaryButtonStyle, border: 0, justifyContent: "space-between", display: "flex", alignItems: "center", textDecoration: "none" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><BookOpen size={15} />Zotero</span><ExternalLink size={13} /></a>
              <a role="menuitem" href="https://github.com/" target="_blank" rel="noreferrer" style={{ ...secondaryButtonStyle, border: 0, justifyContent: "space-between", display: "flex", alignItems: "center", textDecoration: "none" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><GitFork size={15} />GitHub</span><ExternalLink size={13} /></a>
            </div>}
          </div>
          {sidebarMenuOpen && (
            <div
              role="menu"
              style={{ position: "absolute", top: 44, left: "calc(100% + 8px)", zIndex: 40, width: 260, padding: 6, display: "grid", gap: 3, background: "var(--bg-panel)", border: "1px solid var(--border)", borderRadius: "var(--radius-control)", boxShadow: "var(--shadow-pop)" }}
            >
              <button type="button" role="menuitem" onClick={() => { setSidebarMenuOpen(false); setSettingsMenuOpen(false); void createConversation(); }} disabled={submitting} style={{ ...primaryButtonStyle, minHeight: 32, justifyContent: "flex-start", gap: 7 }}><MessageSquarePlus size={15} />新研究会话</button>
              <div style={{ display: "flex", alignItems: "end", gap: 6, padding: "2px 1px 7px", borderBottom: "1px solid var(--border)" }}>
                <label style={{ display: "grid", gap: 3, flex: 1, minWidth: 0, color: "var(--text-muted)", fontSize: 11 }}>
                  主题颜色
                  <select
                    value={themePreference}
                    onChange={(event) => setTheme(event.target.value as ThemePreference)}
                    style={{ width: "100%", minHeight: 30, padding: "0 6px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg)", color: "var(--text)", font: "inherit", fontSize: 12 }}
                  >
                    <option value="system">跟随系统</option>
                    {ALL_THEMES.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
                  </select>
                </label>
                <LanguageSwitcher />
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => setSettingsMenuOpen((open) => !open)}
                aria-expanded={settingsMenuOpen}
                aria-haspopup="menu"
                style={{ ...secondaryButtonStyle, border: 0, justifyContent: "flex-start", display: "flex", alignItems: "center", gap: 7 }}
              >
                <Settings size={15} />设置
              </button>
              {settingsMenuOpen && (
                <div role="menu" aria-label="设置选项" style={{ margin: "0 2px", padding: 4, display: "grid", gap: 2, borderLeft: "2px solid var(--accent)", background: "var(--bg-subtle)", borderRadius: 6 }}>
                  <button type="button" role="menuitem" onClick={() => void openEmailSettings()} style={{ ...secondaryButtonStyle, minHeight: 30, border: 0, justifyContent: "flex-start", display: "flex", alignItems: "center", gap: 7 }}><Mail size={14} />邮件设置</button>
                  <button type="button" role="menuitem" onClick={() => { setSettingsOpen(true); setEmailSettingsOpen(false); setSettingsMenuOpen(false); setSidebarMenuOpen(false); }} style={{ ...secondaryButtonStyle, minHeight: 30, border: 0, justifyContent: "flex-start", display: "flex", alignItems: "center", gap: 7 }}><Settings size={14} />API 设置</button>
                  <button type="button" role="menuitem" onClick={() => { setSettingsMenuOpen(false); setSidebarMenuOpen(false); router.push("/academate/skills"); }} style={{ ...secondaryButtonStyle, minHeight: 30, border: 0, justifyContent: "flex-start", display: "flex", alignItems: "center", gap: 7 }}><Code2 size={14} />Skill 管理</button>
                </div>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => { setSidebarMenuOpen(false); setSettingsMenuOpen(false); void logout(); }}
                style={{ ...secondaryButtonStyle, border: 0, justifyContent: "flex-start", display: "flex", alignItems: "center", gap: 7 }}
              >
                <LogOut size={15} />退出 AcadMate
              </button>
            </div>
          )}
        </div>
        <div style={{ padding: 12 }}><button onClick={() => void createConversation()} disabled={submitting} style={{ ...primaryButtonStyle, width: "100%", display: "flex", justifyContent: "center", gap: 7 }}><MessageSquarePlus size={16} />新研究会话</button></div>
        <nav aria-label="研究会话" style={{ overflowY: "auto", padding: "0 8px 8px", flex: 1 }}>
          {conversations.map((item) => {
            const deleting = deletingConversationId === item.id;
            return (
              <div key={item.id} style={{ position: "relative", marginBottom: 3 }}>
                <button
                  onClick={() => void selectConversation(item.id)}
                  disabled={deleting}
                  style={{ width: "100%", textAlign: "left", padding: "8px 40px 8px 10px", border: "none", borderRadius: "var(--radius-control)", background: active?.id === item.id ? "var(--bg-selected)" : "transparent", color: "var(--text)", cursor: deleting ? "wait" : "pointer" }}
                >
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, fontWeight: active?.id === item.id ? 600 : 400 }}>{item.title || "未命名研究会话"}</div>
                  <div style={{ marginTop: 2, color: "var(--text-dim)", fontSize: 11 }}>{formatDate(item.updated_at)}</div>
                </button>
                <button
                  type="button"
                  onClick={() => void deleteConversation(item)}
                  disabled={deleting || submitting}
                  title={`删除“${item.title || "未命名研究会话"}`}
                  aria-label={`删除“${item.title || "未命名研究会话"}`}
                  style={{ position: "absolute", top: "50%", right: 6, display: "grid", width: 27, height: 27, padding: 0, placeItems: "center", transform: "translateY(-50%)", border: "none", borderRadius: 6, background: "transparent", color: "var(--text-dim)", cursor: deleting || submitting ? "wait" : "pointer" }}
                >
                  <Trash2 size={15} strokeWidth={1.8} aria-hidden="true" />
                </button>
              </div>
            );
          })}
          {!conversations.length && <div style={{ padding: 14, color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6 }}>尚未创建研究会话。</div>}
        </nav>
        <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "grid", gap: 8 }}><button onClick={() => void logout()} style={{ ...secondaryButtonStyle, display: "flex", alignItems: "center", gap: 6 }}><LogOut size={14} />退出 AcadMate</button></div>
        </div>
      </aside>
      {sidebarOpen && (
        <div
          role="separator"
          aria-label="调整侧边栏宽度"
          aria-orientation="vertical"
          tabIndex={0}
          onPointerDown={startSidebarResize}
          onDoubleClick={() => setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") setSidebarWidth((width) => clampSidebarWidth(width - 12));
            if (event.key === "ArrowRight") setSidebarWidth((width) => clampSidebarWidth(width + 12));
            if (event.key === "Enter" || event.key === " ") setSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
          }}
          style={{ width: 5, flexShrink: 0, cursor: "col-resize", touchAction: "none", background: sidebarResizing ? "var(--accent)" : "var(--border)", opacity: sidebarResizing ? 1 : 0.45, transition: "background var(--dur-fast) var(--ease-out-warm), opacity var(--dur-fast) var(--ease-out-warm)" }}
        />
      )}
      <section className="academate-main-panel" style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column" }}>
        <style>{".academate-main-panel > form:last-of-type { order: 3; } .academate-sidebar-content > div:nth-child(2) { display: none; } .academate-session-titlebar .shell-toolbar-btn, .academate-session-titlebar > div > div:last-child { display: none; } .academate-session-titlebar .display-serif { font-size: 15px !important; }"}</style>
        {!isPersonalArea && <>
        <header className="academate-session-titlebar" style={{ minHeight: 42, flexShrink: 0, display: "flex", alignItems: "center", padding: "0 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-panel)" }}>
          <button
            type="button"
            onClick={() => { setSidebarOpen((open) => !open); setSidebarMenuOpen(false); }}
            title={sidebarOpen ? "隐藏侧边栏" : "切换侧边栏"}
            aria-label={sidebarOpen ? "隐藏侧边栏" : "切换侧边栏"}
            className="shell-toolbar-btn ui-focus-ring"
          >
            <PanelLeft size={17} strokeWidth={1.8} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => window.history.back()} title="返回" aria-label="返回" className="shell-toolbar-btn ui-focus-ring">
            <ChevronLeft size={18} strokeWidth={1.8} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => window.history.forward()} title="前进" aria-label="前进" className="shell-toolbar-btn ui-focus-ring">
            <ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" />
          </button>
          <div style={{ minWidth: 0, marginLeft: 8 }}>
            <div className="display-serif" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 21 }}>{active?.title || "选择或创建一个研究会话"}</div>
            <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>论文阅读、问题拆解与研究建议</div>
          </div>
        </header>
        {settingsOpen && <form onSubmit={saveSettings} style={{ padding: "14px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-panel)", display: "grid", gridTemplateColumns: "minmax(180px, 1.4fr) minmax(120px, 1fr) minmax(160px, 1.2fr) auto", gap: 10, alignItems: "end" }}><label style={{ display: "grid", gap: 5, fontSize: 12 }}>API 地址<input required value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" style={inputStyle} /></label><label style={{ display: "grid", gap: 5, fontSize: 12 }}>模型名称<input required value={model} onChange={(e) => setModel(e.target.value)} placeholder="模型 ID" style={inputStyle} /></label><label style={{ display: "grid", gap: 5, fontSize: 12 }}>API Key<input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={llmSettings?.api_key_saved ? "已保存；留空则不更换" : "首次设置必填"} required={!llmSettings?.api_key_saved} style={inputStyle} /></label><button disabled={submitting} type="submit" style={primaryButtonStyle}>{submitting ? "保存中…" : "保存并启用"}</button><div style={{ gridColumn: "1 / -1", color: "var(--text-muted)", fontSize: 12 }}>密钥仅经本地 ompweb 代理转交给 AcadMate；AcadMate 后端会加密保存，读取接口不会返回明文。</div></form>}
        {emailSettingsOpen && emailSettings && <form onSubmit={saveEmailSettings} style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-panel)", display: "grid", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}><strong style={{ display: "flex", alignItems: "center", gap: 7 }}><Mail size={16} />邮件设置</strong><button type="button" onClick={() => setEmailSettingsOpen(false)} style={secondaryButtonStyle}>关闭</button></div>
          <div style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.6 }}>SMTP 用于发送邮件；IMAP 用于读取收件箱。应用密码仅会在你填写并保存时发送，已保存密码不会回显。</div>
          <fieldset style={{ margin: 0, padding: 12, border: "1px solid var(--border)", borderRadius: "var(--radius-control)", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            <legend style={{ padding: "0 5px", fontSize: 13, fontWeight: 650 }}>SMTP 发信</legend>
            <label style={{ display: "grid", gap: 5, fontSize: 12 }}>服务器<input required value={emailSettings.smtp_host} onChange={(event) => setEmailSettings({ ...emailSettings, smtp_host: event.target.value })} placeholder="smtp.example.com" style={inputStyle} /></label>
            <label style={{ display: "grid", gap: 5, fontSize: 12 }}>端口<input required type="number" min="1" max="65535" value={emailSettings.smtp_port} onChange={(event) => setEmailSettings({ ...emailSettings, smtp_port: Number(event.target.value) || 0 })} style={inputStyle} /></label>
            <label style={{ display: "grid", gap: 5, fontSize: 12 }}>账户邮箱<input required type="email" value={emailSettings.smtp_user} onChange={(event) => setEmailSettings({ ...emailSettings, smtp_user: event.target.value })} style={inputStyle} /></label>
            <label style={{ display: "grid", gap: 5, fontSize: 12 }}>发件人<input required type="email" value={emailSettings.smtp_from} onChange={(event) => setEmailSettings({ ...emailSettings, smtp_from: event.target.value })} placeholder="通常与账户邮箱一致" style={inputStyle} /></label>
            <label style={{ display: "grid", gap: 5, fontSize: 12 }}>应用密码<input type="password" autoComplete="new-password" value={smtpPassword} onChange={(event) => setSmtpPassword(event.target.value)} placeholder={emailSettings.smtp_password_saved ? "已保存；留空不修改" : "首次配置必填"} style={inputStyle} /></label>
            <label style={{ alignSelf: "end", display: "flex", alignItems: "center", gap: 7, minHeight: 38, fontSize: 12 }}><input type="checkbox" checked={emailSettings.smtp_secure} onChange={(event) => setEmailSettings({ ...emailSettings, smtp_secure: event.target.checked })} />使用 SSL/TLS</label>
          </fieldset>
          <fieldset style={{ margin: 0, padding: 12, border: "1px solid var(--border)", borderRadius: "var(--radius-control)", display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
            <legend style={{ padding: "0 5px", fontSize: 13, fontWeight: 650 }}>IMAP 收信</legend>
            <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}><input type="checkbox" checked={emailSettings.imap_same_as_smtp} onChange={(event) => setEmailSettings({ ...emailSettings, imap_same_as_smtp: event.target.checked })} />IMAP 与 SMTP 使用相同服务器和账户</label>
            {!emailSettings.imap_same_as_smtp && <>
              <label style={{ display: "grid", gap: 5, fontSize: 12 }}>服务器<input required value={emailSettings.imap_host} onChange={(event) => setEmailSettings({ ...emailSettings, imap_host: event.target.value })} placeholder="imap.example.com" style={inputStyle} /></label>
              <label style={{ display: "grid", gap: 5, fontSize: 12 }}>端口<input required type="number" min="1" max="65535" value={emailSettings.imap_port} onChange={(event) => setEmailSettings({ ...emailSettings, imap_port: Number(event.target.value) || 0 })} style={inputStyle} /></label>
              <label style={{ display: "grid", gap: 5, fontSize: 12 }}>账户邮箱<input required type="email" value={emailSettings.imap_user} onChange={(event) => setEmailSettings({ ...emailSettings, imap_user: event.target.value })} style={inputStyle} /></label>
              <label style={{ display: "grid", gap: 5, fontSize: 12 }}>邮箱文件夹<input value={emailSettings.imap_mailbox} onChange={(event) => setEmailSettings({ ...emailSettings, imap_mailbox: event.target.value })} placeholder="INBOX" style={inputStyle} /></label>
              <label style={{ display: "grid", gap: 5, fontSize: 12 }}>应用密码<input type="password" autoComplete="new-password" value={imapPassword} onChange={(event) => setImapPassword(event.target.value)} placeholder={emailSettings.imap_password_saved ? "已保存；留空不修改" : "首次配置必填"} style={inputStyle} /></label>
              <label style={{ alignSelf: "end", display: "flex", alignItems: "center", gap: 7, minHeight: 38, fontSize: 12 }}><input type="checkbox" checked={emailSettings.imap_secure} onChange={(event) => setEmailSettings({ ...emailSettings, imap_secure: event.target.checked })} />使用 SSL/TLS</label>
            </>}
          </fieldset>
          <button disabled={submitting} type="submit" style={{ ...primaryButtonStyle, justifySelf: "end" }}>{submitting ? "保存中…" : "保存邮件设置"}</button>
        </form>}
        {error && <div role="alert" style={{ margin: "12px 24px 0", padding: "10px 12px", borderRadius: "var(--radius-control)", background: "var(--bg-subtle)", color: "var(--status-error)", fontSize: 13 }}>{error}</div>}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "24px max(24px, calc((100% - 860px) / 2))" }}>
          {active ? <div style={{ display: "grid", gap: 18 }}>{active.messages.map((item) => <article key={item.id} style={{ alignSelf: item.role === "user" ? "end" : "stretch", maxWidth: item.role === "user" ? "80%" : "100%", padding: item.role === "user" ? "11px 14px" : 0, borderRadius: "var(--radius-card)", background: item.role === "user" ? "var(--user-bg)" : "transparent" }}>{item.role === "assistant" ? <MarkdownBody>{item.content}</MarkdownBody> : <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{item.content}</div>}</article>)}{streaming && <article aria-live="polite"><MarkdownBody isStreaming>{streaming}</MarkdownBody><span style={{ color: "var(--accent)", fontSize: 13 }}>正在研究…</span></article>}</div> : <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--text-muted)", textAlign: "center" }}>从左侧新建一个研究会话，开始与 AcadMate 后端协作。</div>}
        </div>
        <form onSubmit={sendMessage} style={{ padding: "12px 24px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 10 }}><textarea disabled={!active || submitting} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={active ? "输入研究问题，例如：帮我梳理这篇论文的方法与局限" : "请先创建研究会话"} rows={2} style={{ ...inputStyle, resize: "vertical", flex: 1, minHeight: 48 }} /><button disabled={!active || !draft.trim() || submitting} type="submit" title="发送研究问题" style={{ ...primaryButtonStyle, width: 48, padding: 0, display: "grid", placeItems: "center" }}><Send size={18} /></button></form>
        <div style={{ order: 2, padding: "0 24px 12px", display: "flex", alignItems: "center", gap: 10 }}>
          <input
            ref={pdfInputRef}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadPdf(file);
            }}
          />
          <button
            type="button"
            disabled={!active || submitting || uploadingPdf}
            onClick={() => pdfInputRef.current?.click()}
            style={{ ...secondaryButtonStyle, display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}
          >
            <Paperclip size={15} />{uploadingPdf ? "上传 PDF 中…" : "附上 PDF"}
          </button>
          {pdfAttachment ? (
            <span title={pdfAttachment.filename} style={{ minWidth: 0, display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 7px 5px 9px", borderRadius: "var(--radius-control)", background: "var(--bg-subtle)", color: "var(--text-muted)", fontSize: 12 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>{pdfAttachment.filename}</span>
              <button type="button" onClick={() => { setPdfAttachment(null); setPdfAgentNotice(null); }} aria-label="移除 PDF 附件" title="移除 PDF 附件" style={{ display: "grid", width: 18, height: 18, padding: 0, placeItems: "center", border: 0, borderRadius: 4, background: "transparent", color: "inherit", cursor: "pointer" }}>
                <X size={14} />
              </button>
            </span>
          ) : (
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>可与文字一起检索</span>
          )}
          {pdfAgentNotice && <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{pdfAgentNotice}</span>}
        </div>
        </>}
        {isPersonalArea && (settingsOpen || emailSettingsOpen) && (
          <div role="presentation" onMouseDown={() => { setSettingsOpen(false); setEmailSettingsOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 60, display: "grid", placeItems: "center", padding: 24, background: "color-mix(in srgb, var(--bg) 48%, transparent)" }}>
            <div role="dialog" aria-modal="true" aria-label={settingsOpen ? "API 设置" : "邮件设置"} onMouseDown={(event) => event.stopPropagation()} style={{ width: "min(920px, 100%)", maxHeight: "min(780px, calc(100vh - 48px))", overflowY: "auto", padding: 20, border: "1px solid var(--border)", borderRadius: "var(--radius-modal)", background: "var(--bg-panel)", boxShadow: "var(--shadow-modal)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}><strong className="display-serif" style={{ fontSize: 20 }}>{settingsOpen ? "API 设置" : "邮件设置"}</strong><button type="button" onClick={() => { setSettingsOpen(false); setEmailSettingsOpen(false); }} style={secondaryButtonStyle}>关闭</button></div>
              {settingsOpen && <form onSubmit={saveSettings} style={{ display: "grid", gap: 12 }}>
                <div style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.6 }}>模型配置按当前账号加密保存；API Key 已保存时留空即可保持不变。</div>
                <label style={{ display: "grid", gap: 5, fontSize: 12 }}>API 地址（Base URL）<input required value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.openai.com/v1" style={inputStyle} /></label>
                <label style={{ display: "grid", gap: 5, fontSize: 12 }}>模型名称<input required value={model} onChange={(event) => setModel(event.target.value)} placeholder="模型 ID" style={inputStyle} /></label>
                <label style={{ display: "grid", gap: 5, fontSize: 12 }}>API Key<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={llmSettings?.api_key_saved ? "已保存；留空则不更换" : "首次设置必填"} required={!llmSettings?.api_key_saved} style={inputStyle} /></label>
                <button disabled={submitting} type="submit" style={{ ...primaryButtonStyle, justifySelf: "end" }}>{submitting ? "保存中…" : "保存并启用"}</button>
              </form>}
              {emailSettingsOpen && emailSettings && <form onSubmit={saveEmailSettings} style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                <p style={{ gridColumn: "1 / -1", margin: 0, color: "var(--text-muted)", fontSize: 12, lineHeight: 1.6 }}>SMTP 用于发信，IMAP 用于读信。应用密码只会在保存本次输入时提交；已保存密码不回显。</p>
                <strong style={{ gridColumn: "1 / -1", fontSize: 14 }}>SMTP 发信</strong>
                <label style={{ display: "grid", gap: 5, fontSize: 12 }}>服务器<input required value={emailSettings.smtp_host} onChange={(event) => setEmailSettings({ ...emailSettings, smtp_host: event.target.value })} placeholder="smtp.example.com" style={inputStyle} /></label><label style={{ display: "grid", gap: 5, fontSize: 12 }}>端口<input required type="number" min="1" max="65535" value={emailSettings.smtp_port} onChange={(event) => setEmailSettings({ ...emailSettings, smtp_port: Number(event.target.value) || 0 })} style={inputStyle} /></label>
                <label style={{ display: "grid", gap: 5, fontSize: 12 }}>账户邮箱<input required type="email" value={emailSettings.smtp_user} onChange={(event) => setEmailSettings({ ...emailSettings, smtp_user: event.target.value })} style={inputStyle} /></label><label style={{ display: "grid", gap: 5, fontSize: 12 }}>发件人<input required type="email" value={emailSettings.smtp_from} onChange={(event) => setEmailSettings({ ...emailSettings, smtp_from: event.target.value })} style={inputStyle} /></label>
                <label style={{ display: "grid", gap: 5, fontSize: 12 }}>应用密码<input type="password" autoComplete="new-password" value={smtpPassword} onChange={(event) => setSmtpPassword(event.target.value)} placeholder={emailSettings.smtp_password_saved ? "已保存；留空不修改" : "首次配置必填"} style={inputStyle} /></label><label style={{ alignSelf: "end", display: "flex", alignItems: "center", gap: 7, minHeight: 38, fontSize: 12 }}><input type="checkbox" checked={emailSettings.smtp_secure} onChange={(event) => setEmailSettings({ ...emailSettings, smtp_secure: event.target.checked })} />使用 SSL/TLS</label>
                <strong style={{ gridColumn: "1 / -1", marginTop: 4, fontSize: 14 }}>IMAP 收信</strong>
                <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}><input type="checkbox" checked={emailSettings.imap_same_as_smtp} onChange={(event) => setEmailSettings({ ...emailSettings, imap_same_as_smtp: event.target.checked })} />IMAP 与 SMTP 使用相同服务器和账户</label>
                {!emailSettings.imap_same_as_smtp && <><label style={{ display: "grid", gap: 5, fontSize: 12 }}>服务器<input required value={emailSettings.imap_host} onChange={(event) => setEmailSettings({ ...emailSettings, imap_host: event.target.value })} placeholder="imap.example.com" style={inputStyle} /></label><label style={{ display: "grid", gap: 5, fontSize: 12 }}>端口<input required type="number" min="1" max="65535" value={emailSettings.imap_port} onChange={(event) => setEmailSettings({ ...emailSettings, imap_port: Number(event.target.value) || 0 })} style={inputStyle} /></label><label style={{ display: "grid", gap: 5, fontSize: 12 }}>账户邮箱<input required type="email" value={emailSettings.imap_user} onChange={(event) => setEmailSettings({ ...emailSettings, imap_user: event.target.value })} style={inputStyle} /></label><label style={{ display: "grid", gap: 5, fontSize: 12 }}>邮箱文件夹<input value={emailSettings.imap_mailbox} onChange={(event) => setEmailSettings({ ...emailSettings, imap_mailbox: event.target.value })} placeholder="INBOX" style={inputStyle} /></label><label style={{ display: "grid", gap: 5, fontSize: 12 }}>应用密码<input type="password" autoComplete="new-password" value={imapPassword} onChange={(event) => setImapPassword(event.target.value)} placeholder={emailSettings.imap_password_saved ? "已保存；留空不修改" : "首次配置必填"} style={inputStyle} /></label><label style={{ alignSelf: "end", display: "flex", alignItems: "center", gap: 7, minHeight: 38, fontSize: 12 }}><input type="checkbox" checked={emailSettings.imap_secure} onChange={(event) => setEmailSettings({ ...emailSettings, imap_secure: event.target.checked })} />使用 SSL/TLS</label></>}
                <button disabled={submitting} type="submit" style={{ ...primaryButtonStyle, gridColumn: "1 / -1", justifySelf: "end" }}>{submitting ? "保存中…" : "保存邮件设置"}</button>
              </form>}
            </div>
          </div>
        )}
        {isProfilePage && <AcadMateProfile />}
        {isDocumentsPage && <AcadMateDocuments />}
        {isMemoryPage && <AcadMateMemory />}
        {isHotTopicsPage && <AcadMateHotTopics />}
        {isCloudPage && <AcadMateCloud />}
        {isSkillsPage && <AcadMateSkills />}
        {children}
      </section>
      </div>
    </main>
  );
}

const inputStyle = { width: "100%", boxSizing: "border-box" as const, padding: "10px 11px", border: "1px solid var(--border)", borderRadius: "var(--radius-control)", background: "var(--bg)", color: "var(--text)", font: "inherit", outline: "none" };
const primaryButtonStyle = { border: "none", borderRadius: "var(--radius-control)", minHeight: 38, padding: "0 13px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--accent)", color: "white", font: "inherit", fontWeight: 600, cursor: "pointer" };
const secondaryButtonStyle = { border: "1px solid var(--border)", borderRadius: "var(--radius-control)", minHeight: 34, padding: "0 10px", background: "transparent", color: "var(--text-muted)", font: "inherit", fontSize: 12, cursor: "pointer" };

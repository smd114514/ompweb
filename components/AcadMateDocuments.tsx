"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, FileText, FolderOpen, LoaderCircle, RefreshCw } from "lucide-react";

type ImportedDocument = {
  document_id: string;
  filename: string;
  page_count: number | null;
  parse_status: string;
  created_at: string | null;
  updated_at: string | null;
};

async function loadDocuments(): Promise<ImportedDocument[]> {
  const response = await fetch("/api/academate/documents");
  const payload = await response.json().catch(() => ({})) as { items?: unknown; message?: unknown };
  if (!response.ok) throw new Error(typeof payload.message === "string" ? payload.message : `请求失败（HTTP ${response.status}）`);
  return Array.isArray(payload.items) ? payload.items.filter((item): item is ImportedDocument => Boolean(item) && typeof item === "object" && typeof (item as ImportedDocument).document_id === "string") : [];
}

function dateLabel(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function parseLabel(status: string): string {
  const labels: Record<string, string> = { uploaded: "已导入", parsed: "已解析", empty_text: "未提取到正文" };
  return labels[status] || status || "已导入";
}

export function AcadMateDocuments() {
  const [items, setItems] = useState<ImportedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await loadDocuments()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "无法读取已导入文件"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  return <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "28px max(24px, calc((100% - 920px) / 2)) 40px" }}>
    <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}><div><div style={{ display: "flex", alignItems: "center", gap: 9 }}><FolderOpen size={22} color="var(--accent)" /><h1 className="display-serif" style={{ margin: 0, fontSize: 26 }}>已导入文件</h1></div><p style={{ margin: "7px 0 0", color: "var(--text-muted)", fontSize: 13 }}>当前账号已经提交过的 PDF 文件夹。文件按上传账号隔离，不显示本机绝对路径。</p></div><button type="button" onClick={() => void refresh()} disabled={loading} style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 34, padding: "0 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-control)", background: "var(--bg-panel)", color: "var(--text-muted)", font: "inherit", fontSize: 12, cursor: loading ? "wait" : "pointer" }}><RefreshCw size={14} className={loading ? "spin" : undefined} />刷新</button></div>
    {error && <div role="alert" style={{ marginBottom: 14, padding: "10px 12px", borderRadius: "var(--radius-control)", background: "var(--bg-subtle)", color: "var(--status-error)", fontSize: 13 }}>{error}</div>}
    <section style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-card)", overflow: "hidden", background: "var(--bg-panel)", boxShadow: "var(--shadow-card)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) 105px 105px 130px 76px", gap: 12, padding: "10px 15px", borderBottom: "1px solid var(--border)", background: "var(--bg-subtle)", color: "var(--text-muted)", fontSize: 11 }}><span>名称</span><span>状态</span><span>页数</span><span>更新时间</span><span>打开</span></div>
      {loading ? <div style={{ display: "grid", minHeight: 160, placeItems: "center", color: "var(--text-muted)", fontSize: 13 }}><span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><LoaderCircle size={17} className="spin" />正在读取文件夹…</span></div> : !items.length ? <div style={{ padding: "42px 16px", color: "var(--text-muted)", textAlign: "center", fontSize: 13, lineHeight: 1.65 }}>这里还没有导入的 PDF。你可在研究对话框中使用“附上 PDF”添加文件。</div> : items.map((item) => <div key={item.document_id} style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) 105px 105px 130px 76px", alignItems: "center", gap: 12, padding: "12px 15px", borderBottom: "1px solid var(--border)" }}><span style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}><FileText size={17} color="var(--accent)" /><span title={item.filename} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{item.filename || "未命名 PDF"}</span></span><span style={{ color: "var(--text-muted)", fontSize: 12 }}>{parseLabel(item.parse_status)}</span><span style={{ color: "var(--text-muted)", fontSize: 12 }}>{item.page_count ?? "—"}</span><span style={{ color: "var(--text-muted)", fontSize: 12 }}>{dateLabel(item.updated_at || item.created_at)}</span><a href={`/api/academate/documents/${encodeURIComponent(item.document_id)}/file`} target="_blank" rel="noreferrer" title="打开 PDF" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-muted)" }}><ExternalLink size={15} /></a></div>)}
    </section>
  </div>;
}

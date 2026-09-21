"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { CheckCircle2, Code2, LoaderCircle, Pencil, Plus, ShieldCheck } from "lucide-react";

type Skill = {
  id: number; name: string; description: string; prompt_template: string; trigger_mode: "manual" | "manual_or_suggest";
  allowed_tools: string[]; permissions: string[]; status: "draft" | "enabled" | "disabled"; version: number;
};
type SkillInput = Pick<Skill, "name" | "description" | "prompt_template" | "trigger_mode" | "allowed_tools" | "permissions">;

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const payload = await response.json().catch(() => ({})) as T & { message?: unknown };
  if (!response.ok) throw new Error(typeof payload.message === "string" ? payload.message : `请求失败（HTTP ${response.status}）`);
  return payload;
}

const newForm = (): SkillInput => ({ name: "", description: "", prompt_template: "", trigger_mode: "manual_or_suggest", allowed_tools: [], permissions: ["read_project_papers"] });

export function AcadMateSkills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [form, setForm] = useState<SkillInput>(newForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setSkills(await requestJson<Skill[]>("/api/academate/skills")); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "无法读取 Skill 列表"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const setList = (value: string, field: "permissions" | "allowed_tools") => setForm((current) => ({ ...current, [field]: value.split(/[,，]/).map((item) => item.trim()).filter(Boolean) }));
  const edit = (skill: Skill) => { setEditingId(skill.id); setForm({ name: skill.name, description: skill.description, prompt_template: skill.prompt_template, trigger_mode: skill.trigger_mode, allowed_tools: skill.allowed_tools, permissions: skill.permissions }); setEditorOpen(true); setError(null); setNotice(null); };
  const create = () => { setEditingId(null); setForm(newForm()); setEditorOpen(true); setError(null); setNotice(null); };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || saving) return;
    setSaving(true); setError(null); setNotice(null);
    try {
      const saved = await requestJson<Skill>(editingId === null ? "/api/academate/skills" : `/api/academate/skills/${editingId}`, { method: editingId === null ? "POST" : "PATCH", body: JSON.stringify(form) });
      setSkills((current) => editingId === null ? [saved, ...current] : current.map((item) => item.id === saved.id ? saved : item));
      setEditorOpen(false); setNotice(editingId === null ? "Skill 已创建。" : "Skill 已更新。");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存 Skill 失败"); }
    finally { setSaving(false); }
  };

  const toggle = async (skill: Skill) => {
    setError(null); setNotice(null);
    try {
      const action = skill.status === "enabled" ? "disable" : "enable";
      const saved = await requestJson<Skill>(`/api/academate/skills/${skill.id}/${action}`, { method: "POST" });
      setSkills((current) => current.map((item) => item.id === saved.id ? saved : item));
      setNotice(saved.status === "enabled" ? "Skill 已启用。" : "Skill 已停用。");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "更新 Skill 状态失败"); }
  };

  const validate = async (skill: Skill) => {
    setError(null); setNotice(null);
    try {
      const result = await requestJson<{ valid: boolean; errors: string[]; note?: string }>(`/api/academate/skills/${skill.id}/validate`, { method: "POST" });
      if (result.valid) setNotice(result.note || "Skill 配置有效。");
      else setError(result.errors.join("；"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "验证 Skill 失败"); }
  };

  return <section style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "clamp(24px, 5vw, 64px)", background: "var(--bg)" }}>
    <div style={{ width: "min(900px, 100%)", margin: "0 auto", display: "grid", gap: 18 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: 14 }}><div><div style={{ display: "flex", alignItems: "center", gap: 10 }}><Code2 size={23} color="var(--accent)" /><h1 className="display-serif" style={{ margin: 0, fontSize: 30 }}>Skill 管理</h1></div><p style={{ margin: "9px 0 0", color: "var(--text-muted)", lineHeight: 1.6 }}>使用旧版 Skill 管理相同的后端接口：`/api/skills`。</p></div><button type="button" onClick={create} style={primaryButton}><Plus size={16} />新建 Skill</button></header>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-control)", background: "var(--bg-subtle)", color: "var(--text-muted)", fontSize: 13 }}><ShieldCheck size={16} color="var(--accent)" />当前版本只允许使用已声明的权限与工具。</div>
      {error && <div role="alert" style={errorStyle}>{error}</div>}{notice && <div role="status" style={noticeStyle}><CheckCircle2 size={15} />{notice}</div>}
      {editorOpen && <form onSubmit={save} style={{ display: "grid", gap: 12, padding: 18, border: "1px solid var(--border)", borderRadius: "var(--radius-card)", background: "var(--bg-panel)", boxShadow: "var(--shadow-card)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}><strong>{editingId === null ? "新建 Skill" : "编辑 Skill"}</strong><button type="button" onClick={() => setEditorOpen(false)} style={secondaryButton}>取消</button></div>
        <label style={labelStyle}>名称<input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} style={inputStyle} /></label>
        <label style={labelStyle}>用途说明<input maxLength={1000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} style={inputStyle} /></label>
        <label style={labelStyle}>提示词模板<textarea value={form.prompt_template} onChange={(event) => setForm({ ...form, prompt_template: event.target.value })} rows={6} style={{ ...inputStyle, minHeight: 120, padding: 10, resize: "vertical" }} /></label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}><label style={labelStyle}>权限（逗号分隔）<input value={form.permissions.join(", ")} onChange={(event) => setList(event.target.value, "permissions")} style={inputStyle} /></label><label style={labelStyle}>允许工具（逗号分隔）<input value={form.allowed_tools.join(", ")} onChange={(event) => setList(event.target.value, "allowed_tools")} style={inputStyle} /></label><label style={labelStyle}>触发方式<select value={form.trigger_mode} onChange={(event) => setForm({ ...form, trigger_mode: event.target.value as Skill["trigger_mode"] })} style={inputStyle}><option value="manual_or_suggest">手动或建议触发</option><option value="manual">仅手动触发</option></select></label></div>
        <button type="submit" disabled={saving || !form.name.trim()} style={{ ...primaryButton, justifySelf: "end" }}>{saving && <LoaderCircle size={15} className="spin" />}{saving ? "保存中…" : "保存 Skill"}</button>
      </form>}
      {loading ? <div style={emptyStyle}><LoaderCircle size={18} className="spin" />正在读取 Skill…</div> : skills.length === 0 ? <div style={emptyStyle}>还没有自定义 Skill。点击“新建 Skill”开始配置。</div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(265px, 1fr))", gap: 14 }}>{skills.map((skill) => <article key={skill.id} style={{ display: "grid", gap: 11, padding: 16, border: "1px solid var(--border)", borderRadius: "var(--radius-card)", background: "var(--bg-panel)", boxShadow: "var(--shadow-card)" }}><div style={{ display: "flex", gap: 9, alignItems: "start" }}><Code2 size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} /><div style={{ minWidth: 0, flex: 1 }}><strong>{skill.name}</strong><div style={{ marginTop: 3, color: "var(--text-muted)", fontSize: 12 }}>v{skill.version} · {skill.trigger_mode === "manual" ? "仅手动触发" : "手动或建议触发"}</div></div><span style={{ ...badgeStyle, color: skill.status === "enabled" ? "var(--accent-strong)" : "var(--text-muted)" }}>{skill.status === "enabled" ? "已启用" : skill.status === "disabled" ? "已停用" : "草稿"}</span></div><p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13, lineHeight: 1.55 }}>{skill.description || "暂无用途说明"}</p>{skill.permissions.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{skill.permissions.map((permission) => <span key={permission} style={badgeStyle}>{permission}</span>)}</div>}<div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}><button type="button" onClick={() => edit(skill)} style={secondaryButton}><Pencil size={14} />编辑</button><button type="button" onClick={() => void validate(skill)} style={secondaryButton}>验证</button><button type="button" onClick={() => void toggle(skill)} style={secondaryButton}>{skill.status === "enabled" ? "停用" : "启用"}</button></div></article>)}</div>}
    </div>
  </section>;
}

const inputStyle = { width: "100%", boxSizing: "border-box" as const, minHeight: 38, padding: "0 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-control)", background: "var(--bg)", color: "var(--text)", font: "inherit" };
const labelStyle = { display: "grid", gap: 6, color: "var(--text-muted)", fontSize: 12 };
const primaryButton = { minHeight: 38, padding: "0 13px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, border: 0, borderRadius: "var(--radius-control)", background: "var(--accent)", color: "white", font: "inherit", fontWeight: 600, cursor: "pointer" };
const secondaryButton = { minHeight: 32, padding: "0 10px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5, border: "1px solid var(--border)", borderRadius: "var(--radius-control)", background: "transparent", color: "var(--text-muted)", font: "inherit", fontSize: 12, cursor: "pointer" };
const badgeStyle = { display: "inline-flex", alignItems: "center", padding: "3px 7px", borderRadius: 99, background: "var(--bg-subtle)", color: "var(--text-muted)", fontSize: 11, whiteSpace: "nowrap" as const };
const errorStyle = { padding: "10px 12px", borderRadius: "var(--radius-control)", background: "var(--bg-subtle)", color: "var(--status-error)", fontSize: 13 };
const noticeStyle = { display: "flex", alignItems: "center", gap: 7, padding: "10px 12px", borderRadius: "var(--radius-control)", background: "var(--bg-subtle)", color: "var(--accent-strong)", fontSize: 13 };
const emptyStyle = { minHeight: 160, display: "grid", placeItems: "center", alignContent: "center", gap: 8, padding: 18, border: "1px dashed var(--border)", borderRadius: "var(--radius-card)", color: "var(--text-muted)", textAlign: "center" as const };

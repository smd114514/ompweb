"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { AlertTriangle, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, LoaderCircle, Mail, Save, Sparkles, Target, UserRound, UsersRound, WandSparkles } from "lucide-react";

type ProfilePage = "information" | "research" | "growth";

const profilePages: Array<{ id: ProfilePage; label: string; href: string }> = [
  { id: "information", label: "个人信息", href: "/academate/profile" },
  { id: "research", label: "科研画像", href: "/academate/profile/research" },
  { id: "growth", label: "科研成长状态", href: "/academate/profile/growth" },
];

type UserProfile = {
  id: number | string;
  email: string;
  nickname?: string;
  grade?: string;
  major?: string;
  interests?: string[];
  skills?: string[];
  bio?: string;
};

type ResearchProfile = {
  type: "research_profile";
  summary: string;
  capabilities: Array<{ name: string; level: string; assessment: string; evidence_status: string }>;
  directions: Array<{ name: string; status: string; rationale: string }>;
  gaps: Array<{ gap: string; why_it_matters: string }>;
  next_actions: Array<{ action: string; deliverable: string; acceptance_criteria: string[] }>;
  missing_information: string[];
  generated_at: string;
  review_status: string;
};

type GrowthState = {
  matched_mentors: Array<{ id: string; name: string }>;
  directions: string[];
  read_papers: Array<{ candidate_id: string; mentor_name?: string; titles: string[] }>;
  verified_experiences: Array<{ id: string; summary: string; evidence_refs?: string[]; source_run_id?: string }>;
  artifacts: Array<{ id: string; title: string }>;
  research_tasks: Array<{ id: string; title: string; status: string; acceptance_criteria: string[] }>;
  direction_hypotheses: Array<{ id: string; direction: string; status: string; evidence_refs?: string[] }>;
};

const emptyGrowth: GrowthState = {
  matched_mentors: [], directions: [], read_papers: [], verified_experiences: [], artifacts: [], research_tasks: [], direction_hypotheses: [],
};

const grades = ["大一", "大二", "大三", "大四", "研一", "研二", "研三", "博一", "博二", "博三", "博四", "博五", "已毕业", "其他"];
const inputStyle = { width: "100%", boxSizing: "border-box" as const, minHeight: 38, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-control)", background: "var(--bg)", color: "var(--text)", font: "inherit", outline: "none" };
const cardStyle = { border: "1px solid var(--border)", borderRadius: "var(--radius-card)", background: "var(--bg-panel)", boxShadow: "var(--shadow-card)" };
const pageNavStyle: CSSProperties = { width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)", borderRadius: "var(--radius-control)", color: "var(--text)", textDecoration: "none", flexShrink: 0 };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const payload = await response.json().catch(() => ({})) as T & { message?: unknown };
  if (!response.ok) throw new Error(typeof payload.message === "string" ? payload.message : `请求失败（HTTP ${response.status}）`);
  return payload;
}

function statusLabel(value: string): string {
  const labels: Record<string, string> = {
    seen: "接触过", understood: "理解", implemented: "实现过", reproduced: "复现过", debugged: "调试过", experimented: "实验验证", innovated: "形成创新",
    interest: "兴趣", hypothesis: "假设", supported: "已有支持", reviewed: "已审核", self_reported: "用户自述", unknown: "证据不足",
    pending: "待完成", in_progress: "进行中", completed: "已完成", blocked: "受阻", rejected: "已否决",
  };
  return labels[value] || value;
}

function TagsField({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (next: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const additions = draft.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
    if (additions.length) onChange(Array.from(new Set([...values, ...additions])));
    setDraft("");
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") { event.preventDefault(); add(); }
    if (event.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1));
  };
  return <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1", fontSize: 13 }}>
    {label}
    <div style={{ ...inputStyle, minHeight: 40, padding: "5px 7px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5 }}>
      {values.map((value) => <span key={value} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 6px", borderRadius: 99, background: "var(--bg-selected)", fontSize: 12 }}>
        {value}<button type="button" onClick={() => onChange(values.filter((item) => item !== value))} aria-label={`移除 ${value}`} style={{ padding: 0, border: 0, background: "transparent", color: "inherit", cursor: "pointer", lineHeight: 1 }}>×</button>
      </span>)}
      <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} onBlur={add} placeholder={placeholder} style={{ minWidth: 150, flex: 1, border: 0, outline: 0, background: "transparent", color: "var(--text)", font: "inherit", fontSize: 13 }} />
    </div>
  </label>;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "28px 16px", color: "var(--text-muted)", textAlign: "center", lineHeight: 1.65, fontSize: 13 }}>{children}</div>;
}

export function AcadMateProfile({ page }: { page: ProfilePage }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [growth, setGrowth] = useState<GrowthState>(emptyGrowth);
  const [researchProfile, setResearchProfile] = useState<ResearchProfile | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [page]);

  useEffect(() => {
    let disposed = false;
    void Promise.all([
      requestJson<UserProfile>("/api/academate/user/profile"),
      requestJson<GrowthState>("/api/academate/user/growth").catch(() => emptyGrowth),
      requestJson<{ profile: ResearchProfile | null; stale: boolean }>("/api/academate/user/research-profile").catch(() => ({ profile: null, stale: false })),
    ]).then(([nextProfile, nextGrowth, nextResearch]) => {
      if (disposed) return;
      setProfile(nextProfile);
      setGrowth(nextGrowth);
      setResearchProfile(nextResearch.profile);
      setStale(nextResearch.stale);
    }).catch((cause) => {
      if (!disposed) setError(cause instanceof Error ? cause.message : "无法读取个人中心");
    }).finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile) return;
    setSaving(true); setError(null); setNotice(null);
    try {
      const saved = await requestJson<UserProfile>("/api/academate/user/profile", {
        method: "PUT",
        body: JSON.stringify({ nickname: profile.nickname || "", grade: profile.grade || "", major: profile.major || "", interests: profile.interests || [], skills: profile.skills || [], bio: profile.bio || "" }),
      });
      setProfile(saved);
      setNotice("个人信息已保存");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败，请重试"); }
    finally { setSaving(false); }
  };

  const generate = async () => {
    setGenerating(true); setError(null); setNotice(null);
    try {
      const result = await requestJson<{ profile: ResearchProfile | null; stale: boolean }>("/api/academate/user/research-profile", { method: "POST" });
      setResearchProfile(result.profile);
      setStale(result.stale);
      setNotice("科研画像已由模型更新");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "科研画像生成失败，请稍后重试"); }
    finally { setGenerating(false); }
  };

  if (loading) return <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--text-muted)" }}><LoaderCircle size={20} className="spin" />正在读取个人中心…</div>;
  if (!profile) return <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--status-error)" }}>{error || "无法读取个人中心"}</div>;

  const pageIndex = profilePages.findIndex((item) => item.id === page);
  const currentPage = profilePages[pageIndex];
  const previousPage = profilePages[pageIndex - 1];
  const nextPage = profilePages[pageIndex + 1];

  return <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
    <div ref={contentRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "28px max(24px, calc((100% - 920px) / 2)) 40px" }}>
    <div style={{ marginBottom: 22, display: "flex", alignItems: "center", gap: 10 }}><span style={{ display: "grid", width: 32, height: 32, placeItems: "center", border: "1px solid var(--border)", borderRadius: 999, color: "var(--accent)" }}>{pageIndex + 1}</span><div><h1 className="display-serif" style={{ margin: 0, fontSize: 26 }}>{currentPage.label}</h1><div style={{ marginTop: 3, color: "var(--text-muted)", fontSize: 13 }}>{profile.nickname || profile.email}</div></div></div>
    {error && <div role="alert" style={{ marginBottom: 14, padding: "10px 12px", borderRadius: "var(--radius-control)", background: "var(--bg-subtle)", color: "var(--status-error)", fontSize: 13 }}>{error}</div>}
    {notice && <div role="status" style={{ marginBottom: 14, padding: "10px 12px", borderRadius: "var(--radius-control)", background: "var(--bg-subtle)", color: "var(--accent-strong)", fontSize: 13 }}>{notice}</div>}

    {page === "information" && <form onSubmit={save} style={{ ...cardStyle, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 16, fontWeight: 650 }}><UserRound size={17} />个人信息</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 13 }}>
        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>邮箱<div style={{ position: "relative" }}><Mail size={14} style={{ position: "absolute", left: 11, top: 12, color: "var(--text-muted)" }} /><input value={profile.email} disabled style={{ ...inputStyle, paddingLeft: 32, opacity: 0.72 }} /></div></label>
        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>昵称<input value={profile.nickname || ""} onChange={(event) => setProfile({ ...profile, nickname: event.target.value })} placeholder="给自己取个昵称" style={inputStyle} /></label>
        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>年级<select value={profile.grade || ""} onChange={(event) => setProfile({ ...profile, grade: event.target.value })} style={inputStyle}><option value="">选择年级</option>{grades.map((grade) => <option key={grade} value={grade}>{grade}</option>)}</select></label>
        <label style={{ display: "grid", gap: 6, fontSize: 13 }}>专业 / 院系<div style={{ position: "relative" }}><UsersRound size={14} style={{ position: "absolute", left: 11, top: 12, color: "var(--text-muted)" }} /><input value={profile.major || ""} onChange={(event) => setProfile({ ...profile, major: event.target.value })} placeholder="例如：计算机科学与技术学院" style={{ ...inputStyle, paddingLeft: 32 }} /></div></label>
        <TagsField label="研究方向" values={profile.interests || []} onChange={(interests) => setProfile({ ...profile, interests })} placeholder="输入后按回车添加" />
        <TagsField label="已有技能" values={profile.skills || []} onChange={(skills) => setProfile({ ...profile, skills })} placeholder="例如：Python、PyTorch" />
        <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1", fontSize: 13 }}>个人简介<textarea value={profile.bio || ""} maxLength={500} rows={4} onChange={(event) => setProfile({ ...profile, bio: event.target.value })} placeholder="简单介绍一下自己（选填）" style={{ ...inputStyle, resize: "vertical" }} /></label>
      </div>
      <button disabled={saving} type="submit" style={{ width: "100%", minHeight: 40, marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, border: 0, borderRadius: "var(--radius-control)", background: "var(--accent)", color: "white", font: "inherit", fontWeight: 650, cursor: saving ? "wait" : "pointer" }}><Save size={15} aria-hidden="true" /><span>{saving ? "保存中…" : "保存"}</span></button>
    </form>}

    {page === "research" && <section style={{ ...cardStyle, overflow: "hidden" }}>
      <div style={{ padding: "15px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}><strong style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Sparkles size={16} color="var(--accent)" />科研画像</strong><button type="button" onClick={() => void generate()} disabled={generating} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-control)", minHeight: 32, padding: "0 10px", background: "transparent", color: "var(--text)", font: "inherit", fontSize: 12, cursor: generating ? "wait" : "pointer" }}><WandSparkles size={14} style={{ marginRight: 5, verticalAlign: -2 }} />{generating ? "模型分析中…" : researchProfile ? "重新生成" : "生成画像"}</button></div>
      {!researchProfile ? <EmptyState>先完善个人信息页的资料，再由模型把兴趣、自述技能与已审核记录整理成科研画像。</EmptyState> : <div style={{ padding: 18 }}>
        {stale && <div style={{ display: "flex", gap: 6, marginBottom: 13, padding: "8px 10px", borderRadius: "var(--radius-control)", background: "var(--bg-subtle)", color: "var(--status-warning)", fontSize: 12 }}><AlertTriangle size={15} />个人信息或成长记录已变化，请重新生成后再使用这份画像。</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, color: "var(--text-muted)", fontSize: 12 }}><span><CheckCircle2 size={14} style={{ verticalAlign: -2 }} /> Review {researchProfile.review_status}</span><span>{new Date(researchProfile.generated_at).toLocaleString("zh-CN")}</span></div>
        <p style={{ margin: "14px 0 18px", lineHeight: 1.75 }}>{researchProfile.summary}</p>
        <ProfileSection title="能力证据阶段">{researchProfile.capabilities.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 9 }}>{researchProfile.capabilities.map((item) => <div key={`${item.name}-${item.level}`} style={{ padding: 11, border: "1px solid var(--border)", borderRadius: "var(--radius-control)" }}><strong>{item.name}</strong><div style={{ display: "flex", gap: 5, margin: "6px 0", color: "var(--accent-strong)", fontSize: 12 }}><span>{statusLabel(item.level)}</span><span>· {statusLabel(item.evidence_status)}</span></div><p style={{ margin: 0, color: "var(--text-muted)", lineHeight: 1.55, fontSize: 12 }}>{item.assessment}</p></div>)}</div> : <Muted>尚无足够信息形成能力判断</Muted>}</ProfileSection>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}><ProfileSection title="研究方向">{researchProfile.directions.map((item) => <ListItem key={item.name} title={`${item.name} · ${statusLabel(item.status)}`} text={item.rationale} />)}</ProfileSection><ProfileSection title="当前缺口">{researchProfile.gaps.map((item) => <ListItem key={item.gap} title={item.gap} text={item.why_it_matters} />)}</ProfileSection></div>
        <ProfileSection title="下一步可验证行动" icon={<Target size={14} />}>{researchProfile.next_actions.length ? <ol style={{ margin: 0, paddingLeft: 19, display: "grid", gap: 9 }}>{researchProfile.next_actions.map((item) => <li key={item.action} style={{ paddingLeft: 4 }}><strong>{item.action}</strong><div style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.55 }}>交付物：{item.deliverable}<br />验收：{item.acceptance_criteria.join("；")}</div></li>)}</ol> : <Muted>暂无可验证行动</Muted>}</ProfileSection>
        {researchProfile.missing_information.length > 0 && <div style={{ padding: "10px 12px", borderRadius: "var(--radius-control)", background: "var(--bg-subtle)", fontSize: 13 }}><strong>仍缺少的信息</strong><div style={{ marginTop: 5, color: "var(--text-muted)" }}>{researchProfile.missing_information.join("；")}</div></div>}
      </div>}
    </section>}

    {page === "growth" && <section style={{ ...cardStyle, padding: 18 }}><strong style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><BookOpen size={16} />科研成长状态</strong><p style={{ margin: "8px 0 16px", color: "var(--text-muted)", fontSize: 12, lineHeight: 1.6 }}>只读记录：匹配成功与论文阅读会自动写回，不在此表单编辑。</p><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}><GrowthBlock title="已匹配导师" values={growth.matched_mentors.map((item) => item.name)} /><GrowthBlock title="关注方向" values={growth.directions} /><GrowthBlock title="方向假设" values={growth.direction_hypotheses.map((item) => `${item.direction} · ${statusLabel(item.status)}`)} /><GrowthBlock title="已读论文" values={growth.read_papers.flatMap((item) => item.titles.slice(0, 8).map((title) => `${item.mentor_name || item.candidate_id}：${title}`))} /><GrowthBlock title="已验证科研经历" values={growth.verified_experiences.map((item) => item.summary)} /><GrowthBlock title="研究任务" values={growth.research_tasks.map((item) => `${item.title} · ${statusLabel(item.status)}`)} /><GrowthBlock title="审核产物" values={growth.artifacts.map((item) => item.title)} /></div></section>}
    </div>
    <nav aria-label="个人中心页面切换" style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 16px", borderTop: "1px solid var(--border)", background: "var(--bg-panel)" }}>
      {previousPage ? <Link href={previousPage.href} aria-label={`上一页：${previousPage.label}`} className="ui-focus-ring" style={pageNavStyle}><ChevronLeft size={17} aria-hidden="true" /></Link> : <span aria-hidden="true" style={{ ...pageNavStyle, opacity: 0.35 }}><ChevronLeft size={17} /></span>}
      {profilePages.map((item, index) => <Link key={item.id} href={item.href} aria-label={`第 ${index + 1} 页：${item.label}`} aria-current={page === item.id ? "page" : undefined} title={item.label} className="ui-focus-ring" style={{ ...pageNavStyle, background: page === item.id ? "var(--bg-selected)" : "transparent", color: page === item.id ? "var(--accent-strong)" : "var(--text-muted)", fontWeight: page === item.id ? 700 : 400 }}>{index + 1}</Link>)}
      {nextPage ? <Link href={nextPage.href} aria-label={`下一页：${nextPage.label}`} className="ui-focus-ring" style={pageNavStyle}><ChevronRight size={17} aria-hidden="true" /></Link> : <span aria-hidden="true" style={{ ...pageNavStyle, opacity: 0.35 }}><ChevronRight size={17} /></span>}
      <span style={{ marginLeft: 8, color: "var(--text-muted)", fontSize: 12 }}>{currentPage.label}</span>
    </nav>
  </div>;
}

function ProfileSection({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) { return <section style={{ marginTop: 18 }}><h2 style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 0 9px", fontSize: 15 }}>{icon}{title}</h2>{children}</section>; }
function ListItem({ title, text }: { title: string; text: string }) { return <div style={{ marginBottom: 9, paddingBottom: 9, borderBottom: "1px solid var(--border)" }}><strong style={{ fontSize: 13 }}>{title}</strong><p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 12, lineHeight: 1.55 }}>{text}</p></div>; }
function Muted({ children }: { children: React.ReactNode }) { return <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{children}</span>; }
function GrowthBlock({ title, values }: { title: string; values: string[] }) { return <div style={{ padding: 11, border: "1px solid var(--border)", borderRadius: "var(--radius-control)" }}><strong style={{ fontSize: 13 }}>{title}</strong>{values.length ? <div style={{ display: "grid", gap: 5, marginTop: 8 }}>{values.map((value) => <span key={value} style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.45 }}>{value}</span>)}</div> : <div style={{ marginTop: 8, color: "var(--text-dim)", fontSize: 12 }}>暂无记录</div>}</div>; }

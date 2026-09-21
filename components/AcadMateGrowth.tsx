"use client";

import { useEffect, useState } from "react";
import { BookOpen, CheckCircle2, ClipboardList, LoaderCircle, UsersRound } from "lucide-react";

type Growth = {
  matched_mentors: Array<{ id: string; name: string }>;
  directions: string[];
  read_papers: Array<{ candidate_id: string; mentor_name?: string; titles: string[] }>;
  verified_experiences: Array<{ id: string; summary: string; evidence_refs?: string[]; source_run_id?: string }>;
  artifacts: Array<{ id: string; title: string }>;
  research_tasks: Array<{ id: string; title: string; status: string; acceptance_criteria: string[] }>;
  direction_hypotheses: Array<{ id: string; direction: string; status: string; evidence_refs?: string[] }>;
};

const emptyGrowth: Growth = { matched_mentors: [], directions: [], read_papers: [], verified_experiences: [], artifacts: [], research_tasks: [], direction_hypotheses: [] };

async function getGrowth(): Promise<Growth> {
  const response = await fetch("/api/academate/user/growth");
  const payload = await response.json().catch(() => ({})) as Growth & { message?: unknown };
  if (!response.ok) throw new Error(typeof payload.message === "string" ? payload.message : `请求失败（HTTP ${response.status}）`);
  return { ...emptyGrowth, ...payload };
}

function status(value: string): string { return ({ pending: "待完成", in_progress: "进行中", completed: "已完成", blocked: "受阻", hypothesis: "假设", supported: "已有支持", rejected: "已否决" } as Record<string, string>)[value] || value; }
function Block({ title, children }: { title: string; children: React.ReactNode }) { return <section style={{ padding: 15, border: "1px solid var(--border)", borderRadius: "var(--radius-card)", background: "var(--bg-panel)", boxShadow: "var(--shadow-card)" }}><h2 style={{ margin: "0 0 11px", fontSize: 15 }}>{title}</h2>{children}</section>; }
function Empty() { return <span style={{ color: "var(--text-dim)", fontSize: 12 }}>暂无记录</span>; }

export function AcadMateGrowth() {
  const [growth, setGrowth] = useState<Growth>(emptyGrowth);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let disposed = false; void getGrowth().then((value) => { if (!disposed) setGrowth(value); }).catch((cause) => { if (!disposed) setError(cause instanceof Error ? cause.message : "无法读取成长记录"); }).finally(() => { if (!disposed) setLoading(false); }); return () => { disposed = true; }; }, []);
  if (loading) return <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--text-muted)" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><LoaderCircle className="spin" size={18} />正在读取成长记录…</span></div>;
  return <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "28px max(24px, calc((100% - 920px) / 2)) 40px" }}><div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 20 }}><ClipboardList size={22} color="var(--accent)" /><div><h1 className="display-serif" style={{ margin: 0, fontSize: 26 }}>成长记录</h1><p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 13 }}>来自导师匹配、论文阅读与已审核科研活动的只读记录。</p></div></div>{error ? <div role="alert" style={{ padding: "10px 12px", borderRadius: "var(--radius-control)", color: "var(--status-error)", background: "var(--bg-subtle)" }}>{error}</div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 14 }}><Block title="已匹配导师">{growth.matched_mentors.length ? growth.matched_mentors.map((item) => <div key={item.id} style={row}>{item.name}</div>) : <Empty />}</Block><Block title="关注方向">{growth.directions.length ? growth.directions.map((item) => <span key={item} style={tag}>{item}</span>) : <Empty />}</Block><Block title="方向假设">{growth.direction_hypotheses.length ? growth.direction_hypotheses.map((item) => <div key={item.id} style={row}><strong>{item.direction}</strong><span style={muted}> · {status(item.status)} · Evidence {item.evidence_refs?.length || 0}</span></div>) : <Empty />}</Block><Block title="已读论文">{growth.read_papers.length ? growth.read_papers.flatMap((item) => item.titles.slice(0, 8).map((title) => <div key={`${item.candidate_id}-${title}`} style={row}><BookOpen size={13} style={{ marginRight: 5, verticalAlign: -2 }} />{item.mentor_name || item.candidate_id}：{title}</div>)) : <Empty />}</Block><Block title="已验证科研经历">{growth.verified_experiences.length ? growth.verified_experiences.map((item) => <div key={item.id} style={row}><CheckCircle2 size={13} style={{ marginRight: 5, verticalAlign: -2 }} />{item.summary}</div>) : <Empty />}</Block><Block title="研究任务">{growth.research_tasks.length ? growth.research_tasks.map((item) => <div key={item.id} style={row}><strong>{item.title}</strong><span style={muted}> · {status(item.status)}</span>{item.acceptance_criteria.map((criterion) => <div key={criterion} style={{ ...muted, marginTop: 4 }}>· {criterion}</div>)}</div>) : <Empty />}</Block><Block title="审核产物">{growth.artifacts.length ? growth.artifacts.map((item) => <div key={item.id} style={row}>{item.title}</div>) : <Empty />}</Block></div>}</div>;
}

const row = { marginTop: 8, color: "var(--text-muted)", fontSize: 12, lineHeight: 1.55 };
const muted = { color: "var(--text-dim)", fontSize: 12 };
const tag = { display: "inline-block", margin: "0 6px 6px 0", padding: "4px 7px", borderRadius: 99, background: "var(--bg-subtle)", color: "var(--text-muted)", fontSize: 12 };

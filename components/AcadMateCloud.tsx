"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { LoaderCircle, Orbit, RefreshCw, Search } from "lucide-react";

type CloudNode = {
  id: string; name: string; department?: string; domain?: string; domain_name?: string; color?: string;
  x?: number; y?: number; z?: number; size?: number; tags?: string[]; methods?: string[]; pubs?: string[];
};
type CloudEdge = { source: string; target: string };
type CloudData = {
  nodes: CloudNode[]; edges: CloudEdge[];
  meta?: { evidence_count?: number; generated_at?: string; legend?: Array<{ id: string; name: string; color: string; count: number }>; warnings?: string[] };
};

async function getCloud(): Promise<CloudData> {
  const response = await fetch("/api/academate/cloud/graph");
  const payload = await response.json().catch(() => ({})) as CloudData & { message?: unknown };
  if (!response.ok) throw new Error(typeof payload.message === "string" ? payload.message : `请求失败（HTTP ${response.status}）`);
  return payload;
}

function point(node: CloudNode, index: number, all: CloudNode[]) {
  const valuesX = all.map((item) => item.x ?? 0);
  const valuesZ = all.map((item) => item.z ?? 0);
  const minX = Math.min(...valuesX), maxX = Math.max(...valuesX), minZ = Math.min(...valuesZ), maxZ = Math.max(...valuesZ);
  const x = node.x === undefined || maxX === minX ? 500 + Math.cos(index) * 180 : 45 + ((node.x - minX) / (maxX - minX)) * 910;
  const y = node.z === undefined || maxZ === minZ ? 300 + Math.sin(index) * 180 : 40 + ((node.z - minZ) / (maxZ - minZ)) * 520;
  return { x, y };
}

export function AcadMateCloud() {
  const [data, setData] = useState<CloudData | null>(null);
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await getCloud()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "无法读取星图数据"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const nodes = useMemo(() => (data?.nodes ?? []).filter((node) => domain === "all" || node.domain === domain), [data, domain]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = useMemo(() => !normalizedQuery ? [] : nodes.filter((node) => [node.name, node.department, node.domain_name, ...(node.tags ?? [])].join(" ").toLocaleLowerCase().includes(normalizedQuery)).slice(0, 8), [nodes, normalizedQuery]);
  const selected = nodes.find((node) => node.id === selectedId) ?? data?.nodes.find((node) => node.id === selectedId);
  const coordinates = useMemo(() => new Map(nodes.map((node, index) => [node.id, point(node, index, nodes)])), [nodes]);
  const visibleIds = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes]);
  const edges = useMemo(() => (data?.edges ?? []).filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)).slice(0, 1200), [data, visibleIds]);
  const legend = data?.meta?.legend ?? [];

  return <section style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "clamp(20px, 4vw, 48px)", background: "var(--bg)" }}>
    <div style={{ width: "min(1120px, 100%)", margin: "0 auto", display: "grid", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div><div style={{ display: "flex", alignItems: "center", gap: 10 }}><Orbit size={24} color="var(--accent)" /><h1 className="display-serif" style={{ margin: 0, fontSize: 30 }}>导师研究星图</h1></div><p style={{ margin: "9px 0 0", color: "var(--text-muted)", lineHeight: 1.6 }}>数据直接来自旧版云图所使用的后端接口：`/api/cloud/graph`。</p></div>
        <button type="button" onClick={() => void load()} disabled={loading} style={buttonStyle}><RefreshCw size={15} className={loading ? "spin" : undefined} />刷新数据</button>
      </header>
      {error && <div role="alert" style={alertStyle}>{error}</div>}
      {data?.meta?.warnings?.map((warning) => <div key={warning} style={{ ...alertStyle, color: "var(--text-muted)" }}>{warning}</div>)}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ position: "relative", flex: "1 1 260px", minWidth: 220 }}><Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "var(--text-muted)" }} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索导师、院系或研究方向" style={{ ...inputStyle, paddingLeft: 32 }} /></label>
        <select value={domain} onChange={(event) => { setDomain(event.target.value); setSelectedId(null); }} style={{ ...inputStyle, width: "auto", minWidth: 180 }}><option value="all">全部研究方向</option>{legend.map((item) => <option key={item.id} value={item.id}>{item.name}（{item.count}）</option>)}</select>
      </div>
      {matches.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{matches.map((node) => <button key={node.id} type="button" onClick={() => setSelectedId(node.id)} style={{ ...tagStyle, cursor: "pointer" }}><span style={{ width: 8, height: 8, borderRadius: 99, background: node.color || "var(--accent)" }} />{node.name}</button>)}</div>}
      {loading ? <div style={emptyStyle}><LoaderCircle size={18} className="spin" />正在读取星图数据…</div> : !data ? null : <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(230px, 300px)", gap: 16, alignItems: "start" }}>
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-card)", overflow: "hidden", background: "radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--accent) 16%, var(--bg-panel)), var(--bg-panel) 60%)", boxShadow: "var(--shadow-card)" }}>
          {nodes.length === 0 ? <div style={emptyStyle}>当前筛选条件下没有可显示的节点。</div> : <svg viewBox="0 0 1000 600" role="img" aria-label={`导师研究星图，共 ${nodes.length} 位导师`} style={{ display: "block", width: "100%", minHeight: 380, maxHeight: "62vh" }}>
            {edges.map((edge, index) => { const source = coordinates.get(edge.source), target = coordinates.get(edge.target); return source && target ? <line key={`${edge.source}-${edge.target}-${index}`} x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke="var(--border)" strokeOpacity="0.45" strokeWidth="0.8" /> : null; })}
            {nodes.map((node, index) => { const position = coordinates.get(node.id) ?? point(node, index, nodes); const selectedNode = selectedId === node.id; return <circle key={node.id} cx={position.x} cy={position.y} r={Math.max(3, Math.min(12, (node.size ?? 4) * 0.8))} fill={node.color || "var(--accent)"} opacity={selectedNode ? 1 : 0.78} stroke={selectedNode ? "var(--text)" : "transparent"} strokeWidth="2" style={{ cursor: "pointer" }} onClick={() => setSelectedId(node.id)}><title>{node.name} · {node.domain_name || "未分类"}</title></circle>; })}
          </svg>}
        </div>
        <aside style={{ padding: 16, border: "1px solid var(--border)", borderRadius: "var(--radius-card)", background: "var(--bg-panel)", boxShadow: "var(--shadow-card)" }}>
          <strong>{selected ? selected.name : "选择一个节点"}</strong>
          {selected ? <div style={{ marginTop: 10, display: "grid", gap: 9, color: "var(--text-muted)", fontSize: 13, lineHeight: 1.55 }}><span>{selected.department || "院系信息暂无"}</span><span>{selected.domain_name || "未分类研究方向"}</span>{selected.tags?.length ? <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{selected.tags.map((tag) => <span key={tag} style={tagStyle}>{tag}</span>)}</div> : null}{selected.methods?.length ? <div>方法：{selected.methods.join("、")}</div> : null}{selected.pubs?.length ? <div>代表论文：{selected.pubs.slice(0, 3).join("；")}</div> : null}</div> : <p style={{ margin: "10px 0 0", color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6 }}>点击星点或搜索结果，查看导师研究信息。</p>}
          <div style={{ marginTop: 18, paddingTop: 12, borderTop: "1px solid var(--border)", color: "var(--text-muted)", fontSize: 12, lineHeight: 1.7 }}>导师 {data.meta?.legend?.reduce((sum, item) => sum + item.count, 0) ?? data.nodes.length} 位<br />证据 {data.meta?.evidence_count ?? 0} 条</div>
        </aside>
      </div>}
    </div>
  </section>;
}

const inputStyle = { boxSizing: "border-box" as const, minHeight: 38, padding: "0 11px", border: "1px solid var(--border)", borderRadius: "var(--radius-control)", background: "var(--bg-panel)", color: "var(--text)", font: "inherit" };
const buttonStyle = { minHeight: 36, padding: "0 12px", display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--border)", borderRadius: "var(--radius-control)", background: "var(--bg-panel)", color: "var(--text-muted)", font: "inherit", cursor: "pointer" };
const tagStyle = { display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 8px", border: "1px solid var(--border)", borderRadius: 99, background: "var(--bg-subtle)", color: "var(--text-muted)", fontSize: 12 };
const alertStyle = { padding: "10px 12px", borderRadius: "var(--radius-control)", background: "var(--bg-subtle)", color: "var(--status-error)", fontSize: 13 };
const emptyStyle = { minHeight: 260, display: "grid", placeItems: "center", alignContent: "center", gap: 8, color: "var(--text-muted)", textAlign: "center" as const };

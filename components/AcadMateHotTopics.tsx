import { Flame } from "lucide-react";

export function AcadMateHotTopics() {
  return <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "28px max(24px, calc((100% - 920px) / 2)) 40px" }}><div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 20 }}><Flame size={22} color="var(--accent)" /><div><h1 className="display-serif" style={{ margin: 0, fontSize: 26 }}>近期热点</h1><p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 13 }}>用于汇总你关注研究方向的近期热点。</p></div></div><section style={{ padding: "40px 22px", border: "1px solid var(--border)", borderRadius: "var(--radius-card)", background: "var(--bg-panel)", boxShadow: "var(--shadow-card)", color: "var(--text-muted)", textAlign: "center", lineHeight: 1.7, fontSize: 13 }}>近期热点的数据源尚未配置。该页面已保留独立入口，后续可接入论文、会议或你指定的资讯源。</section></div>;
}

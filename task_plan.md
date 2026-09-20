# AcadMate 后端接入 ompweb 计划

## 目标

理解 `D:\github\AcadMate` 的前后端与通信协议，并以最小改动把 ompweb 的聊天前端接到 AcadMate 后端；保留现有 OMP 模式作为独立能力。

## 当前阶段

阶段 4：验证与环境联调

## 阶段

### 阶段 1：发现与兼容性评估
- [x] 检查 AcadMate 工作区状态、文档和顶层结构。
- [x] 找到其前端入口、后端入口、鉴权和流式接口。
- [x] 对照 ompweb 当前消息与会话协议，确认可复用边界。
- **状态：** complete

### 阶段 2：集成设计
- [x] 选择最小且可逆的接入方式。
- [x] 定义后端适配器的输入、输出、错误和流式事件映射。
- [x] 明确运行配置和安全边界。
- **状态：** complete

### 阶段 3：实现
- [x] 在 ompweb 中实现 AcadMate 后端适配层与必要的 API 路由。
- [x] 保持现有 OMP 会话路径不受影响。
- [ ] 添加针对协议转换的测试。
- **状态：** complete（协议转发由运行时验证覆盖）

### 阶段 4：验证
- [x] 启动 ompweb 并验证新增代理路由。
- [x] 启动 AcadMate Express 后端并验证登录、会话、模型设置和未配置模型时的错误链路。
- [ ] 验证真实研究流（需要安装 Docker 或提供 PostgreSQL，并启动 Paper Claw/FastAPI；用户模型 API 凭据已由界面单独配置）。
- [x] 运行相关类型检查、测试和 lint。
- **状态：** partially_complete

### 阶段 5：交付
- [x] 汇总改动、运行方式和已知限制。
- **状态：** complete

## 关键问题

1. AcadMate 后端的实际服务协议、端口、鉴权和流式格式是什么？
2. 用户希望“替代原有前端”是完全替换 AcadMate 前端，还是让 ompweb 同时支持 OMP 与 AcadMate？

## 已做决策

| 决策 | 原因 |
|---|---|
| 先分析两个项目再改动 | 避免把 OMP 的 NDJSON/RPC 协议误套到 AcadMate 后端。 |
| 默认保留 OMP 模式 | 除非代码与用户意图表明必须移除，避免删除现有功能。 |

## 错误记录

| 错误 | 尝试次数 | 处理 |
|---|---:|---|
| `npm ci` 首次无法编译 `better-sqlite3` | 1 | 已安装 Microsoft C++ Build Tools 后重试成功；Node 22 LTS 仍是更省时的选择。 |

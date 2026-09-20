# AcadMate 前端适配入口

`/academate` 是 ompweb 中新增的 AcadMate 研究会话入口。它保留原有 OMP 编程助手（`/`），但用 ompweb 的界面连接 AcadMate 的 Express BFF。

## 已覆盖的能力

- 使用 AcadMate 原有的邮箱/密码登录；首次登录仍由原后端自动注册。
- 登录 JWT 只保存在 ompweb 的 `HttpOnly` Cookie 中，不暴露给浏览器脚本。
- 创建、读取和切换 `research` 类型会话。
- 转发 AcadMate 的 NDJSON 研究对话流，逐段显示 `agent_chunk` 输出。
- 读取和保存当前账号的模型 API 设置；密钥由 AcadMate 后端加密保存，读取时不返回明文。

未迁移的页面能力包括论文库、项目、导师检索、云图、邮件和报告。这些应在研究会话稳定后按页面逐项迁移，不能把它们误当作 OMP 的本地 JSONL 会话。

## 本地启动顺序

1. 推荐对 `AcadMate/Code` 使用 Node.js 22 LTS。Node 24 也能运行，但 `better-sqlite3` 可能回退到本地 C++ 编译；此时需安装 Visual Studio 的 Desktop development with C++ / Build Tools 工作负载。
2. 在 `D:\github\AcadMate\Code` 执行 `npm ci`，然后执行 `npm run dev:backend`。首次启动会从 `.env.example` 创建本机 `.env` 并生成随机 `JWT_SECRET`。
3. 要获得实际 AI 回复，还需按 AcadMate 的说明启动 `paper-claw-master/backend`（默认 `8000`）并在新页面“模型设置”中配置当前账号的 API 地址、模型和密钥。
4. 在 `D:\github\ompweb` 执行 `npm run dev`，打开 `http://127.0.0.1:30178/academate`。

默认情况下，ompweb 代理到 `http://127.0.0.1:3001`。如果 Express BFF 部署在其他位置，在启动 ompweb 前设置 `ACADEMATE_API_BASE_URL` 为其完整 `http(s)` 地址。

## 数据流

```text
浏览器 /academate
  → ompweb /api/academate/*（Cookie 鉴权、同源代理）
  → AcadMate Express :3001（JWT、SQLite、用户模型设置）
  → Paper Claw FastAPI :8000（研究工作流、NDJSON）
```

由于浏览器只请求 ompweb，同源部署时不需要把 `30178` 加进 AcadMate 的 `CORS_ORIGINS`。

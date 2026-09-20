# AcadMate 接入 ompweb：发现与决策

## 2026-09-20：本地服务启动复查

- Docker Desktop 4.91.0 位于 `%LOCALAPPDATA%\Programs\DockerDesktop`，Linux Engine 29.8.0 已启动。
- `docker compose up -d` 已创建并启动 PostgreSQL；容器健康检查为 healthy，数据库迁移版本为 `0001_current_schema`。
- Paper Claw FastAPI `GET /api/ready` 返回 200，`database: true`；AcadMate Express `GET /api/health` 返回 200。
- OMP Web `/academate` 返回 200；通过该页面的同源代理使用本地测试账号登录和读取会话，两个请求均返回 200。
- OMP Web 自带的 `omp` 功能仍提示未配置可用模型；这与 AcadMate 的模型设置相互独立。AcadMate 的真实模型网关调用尚未用用户账号验证。

## 需求

- 读取 `D:\github\AcadMate` 的既有前后端。
- 尝试以 ompweb 的界面替代其现有前端，接入该项目后端。

## 当前发现

- `AcadMate` 的主前端为 `Code/src`（React 18 + Vite + TypeScript），不是 Vue。
- 面向浏览器的后端为 `Code/server`（Express + SQLite + JWT），默认端口 `3001`；AI 研究工作流位于 `paper-claw-master/backend`（FastAPI），默认端口 `8000`。
- 浏览器应先访问 Express BFF：它负责 JWT、用户配置、会话持久化和到 FastAPI 的流式转发；不应让新前端直接调用 FastAPI。
- `POST /api/agent/chat` 采用 SSE；`POST /api/conversations/:id/messages/stream` 采用 NDJSON；两者都要求 `Authorization: Bearer <JWT>`。
- ompweb 的既有聊天依赖本地 `omp` 进程和 JSONL 会话格式，需为 AcadMate 创建独立适配层，不能直接复用其流事件处理。
- AcadMate 的用户模型设置接口为 `GET/PUT /api/user/api-settings`；读取不会返回明文密钥，保存时后端会加密。

## 已实现的接入边界

- 新入口为 `/academate`，原 `/` OMP 工作区未替换、未删除。
- ompweb 的 `/api/academate/*` 负责登录、`HttpOnly` Cookie、研究会话、模型设置和 NDJSON 透传。
- 适配器默认连接 `http://127.0.0.1:3001`，可用 `ACADEMATE_API_BASE_URL` 覆盖；不直连 FastAPI。

## 本机联调结果

- Microsoft Visual Studio 2022 Build Tools 的 `Microsoft.VisualStudio.Workload.VCTools` 已安装；MSVC 14.44 与 MSBuild 均可用。
- 在 Node 24 下重新执行 `npm ci` 后，AcadMate 的 385 个锁定依赖安装成功；其服务端 TypeScript 检查通过。
- Express BFF 已启动在 `http://127.0.0.1:3001`；经 ompweb 同源代理验证了登录 Cookie、创建/读取研究会话、读取模型设置。
- 未配置模型时，研究流接口返回 BFF 原始的 `428 API 设置缺失` 提示，符合界面预期。

## 2026-09-20：真实研究流阻塞诊断

- `3001`（Express）与 `30178`（ompweb）正在监听，但 `8000`（Paper Claw FastAPI）和 `5432`（PostgreSQL）均未监听。
- 本机未安装 Docker，无法使用项目提供的 `docker-compose.yml` 拉起 PostgreSQL。
- Express 将 FastAPI 连接失败归类为“科研模型网关连接失败”，因此该提示不能单独证明用户填写的 Base URL 或 API Key 有误。
- 尝试安装 Docker 所需 WSL 2 平台时，Windows 返回“需要提升权限”；当前自动化会话无法启用 Windows 可选功能，因此 Docker 安装尚未开始。

## 2026-09-20：重启后的 Docker 检查

- WSL 版本命令显示 2.7.14，表示 WSL 平台已安装；当前受限自动化终端枚举发行版时返回 `Wsl/EnumerateDistros/Service/E_ACCESSDENIED`，不能用它判断用户桌面会话下的 WSL 是否异常。
- Docker Desktop 尚未安装。官方下载连接一度重置，随后得到的安装器 SHA-256 与 Docker 官方发布校验值不匹配，因此未执行，并已删除该不可信文件。
- `C:\Program` 是当前已注册、可用的 Visual Studio Build Tools 安装目录；不要手动重命名或删除它。

## 技术决策

| 决策 | 原因 |
|---|---|
| 采用渐进迁移 | 先在 ompweb 内增加 AcadMate 适配入口，保留原有 OMP 页面，避免破坏既有工作流。 |

## 问题与处理

| 问题 | 处理 |
|---|---|
| Windows 下 `rg -g vite.config.*` 触发路径通配符错误 | 后续使用 `-LiteralPath` 或不带该 glob 的枚举。 |

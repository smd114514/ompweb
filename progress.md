# 进度日志

## 2026-09-20：本地联调服务已启动

- 启动 Docker Desktop、PostgreSQL 容器，安装 Paper Claw 锁定的 Python 依赖并执行 Alembic 迁移。
- 启动 FastAPI（8000）、AcadMate Express（3001）和 OMP Web（30178）。
- 验证 FastAPI `/api/ready`、Express `/api/health`、`/academate` 页面及 AcadMate 代理登录和会话读取均返回 200。

## 会话：2026-09-20

### 阶段 1：发现与兼容性评估
- **状态：** in_progress
- 已执行：
  - 确认 AcadMate 位于 `D:\github\AcadMate`。
  - 创建任务规划、发现和进度记录。
- 修改文件：
  - `task_plan.md`
  - `findings.md`
  - `progress.md`

### 发现补充

- 已读取 AcadMate 根说明、`Code/package.json`、前端请求层与 Express 入口。
- 确认主聊天流为 SSE，研究会话流为 NDJSON，并都通过 Express BFF 的 JWT 鉴权。

### 阶段 2-3：设计与实现

- 新增 `/academate` 独立研究工作台，以及 `/api/academate/*` BFF 代理路由。
- 令牌由 `HttpOnly` Cookie 保存；新增模型 API 设置界面，不读取或展示明文密钥。
- 原 OMP 页面、API 和会话机制未修改。

## 测试结果

| 测试 | 输入 | 预期 | 实际 | 状态 |
|---|---|---|---|---|
| TypeScript | `npm run typecheck` | 新增代码通过类型检查 | 通过 | 通过 |
| ESLint | `npm run lint` | 无新增 error | 0 error；2 条仓库既有 Hook warning | 通过（有既有警告） |
| 代理未登录路径 | `GET /api/academate/conversations` | 401 | 401，请先登录 AcadMate | 通过 |
| AcadMate 本机联调 | 安装 Build Tools 后重新执行 `npm ci` | 安装依赖并启动 Express | 385 个依赖安装成功，Express 已启动 | 通过 |
| 页面视觉检查 | 计算机使用浏览器 | 加载 `/academate` | 当前环境没有可用浏览器表面 | 未执行 |
| AcadMate 服务端类型检查 | `npm run typecheck:server` | 通过 | 通过 | 通过 |
| 登录与会话代理 | `POST login`、会话 GET/POST | Cookie 和会话成功 | `200` | 通过 |
| 未配置模型的研究流 | `POST .../stream` | 明确引导错误 | `428` | 通过 |

## 错误日志

| 时间 | 错误 | 尝试次数 | 处理 |
|---|---|---:|---|
| 2026-09-20 | `better-sqlite3` 在 Node 24 下需本地 C++ 编译，但缺少 Visual Studio C++ 工具链 | 1 | 已安装 Build Tools 后重试成功。 |
| 2026-09-20 | 真实研究流报“模型网关连接失败” | 1 | 已确认 `8000` FastAPI、`5432` PostgreSQL 未启动且 Docker 未安装；先补齐 Paper Claw 运行环境。 |
| 2026-09-20 | `wsl --install --no-distribution` 被系统拒绝 | 1 | 需要用户在管理员 PowerShell 执行，并在要求时重启；Docker Desktop 安装暂缓。 |
| 2026-09-20 | Docker 官方安装器 SHA-256 不匹配 | 1 | 未执行安装器，已删除不匹配文件；需恢复可校验的官方下载通道后再安装。 |

### 环境修复与联调续报

- 已从微软官方安装 Visual Studio 2022 Build Tools 的 C++ 工作负载；安装器退出码为 `0`。
- 重新执行 `npm ci` 成功安装 385 个依赖；`npm run typecheck:server` 通过。
- 已启动 `Code/server` 的 Express BFF（`3001`）。通过 ompweb 验证：登录 `200`、`HttpOnly` Cookie、会话读取 `200`、模型设置读取 `200`、未配模型研究流 `428`。
- 为验证创建了本机测试账号 `ompweb-adapter-test@local.invalid` 与一条研究会话；未配置、未传输真实模型 API Key。

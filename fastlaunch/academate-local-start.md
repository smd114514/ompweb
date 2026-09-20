# AcadMate 本地启动备忘

适用于当前电脑（Windows PowerShell）。

## 一键启动

打开 PowerShell，运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "D:\github\ompweb\fastlaunch\start-academate.ps1"
```

脚本会启动 Docker Desktop 与 PostgreSQL，执行数据库迁移，然后启动 Paper Claw FastAPI、AcadMate Express 后端和 OMP Web。已有服务会跳过；脚本会等待各服务响应后显示页面地址。后台服务日志保存在 `%LOCALAPPDATA%\AcadMateFastLaunch\logs`。

## 手动启动

如需分别观察各服务的实时输出，可按以下顺序启动。第 2～4 步请分别使用独立的 PowerShell 窗口。

### 1. Docker 和 PostgreSQL

```powershell
$dockerCli = "C:\Users\DAO\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe"
& $dockerCli desktop start
cd D:\github\AcadMate\paper-claw-master
& $dockerCli compose up -d
```

Docker 首次启动可能需要稍等。可用 `& $dockerCli version` 检查是否已出现 `Server: Docker Desktop`。

### 2. Paper Claw FastAPI

```powershell
cd D:\github\AcadMate\paper-claw-master
& "D:\github\AcadMate\paper-claw-master\backend\.venv\Scripts\uvicorn.exe" backend.api.app:create_app --factory --host 127.0.0.1 --port 8000
```

### 3. AcadMate Express 后端

```powershell
cd D:\github\AcadMate\Code
& "D:\node\npm.cmd" run dev:backend
```

### 4. OMP Web 前端

```powershell
cd D:\github\ompweb
& "D:\node\npm.cmd" run dev
```

使用 `npm.cmd` 是为了避开当前 PowerShell 对 `npm.ps1` 的脚本执行限制。

## 访问地址

- AcadMate 页面：<http://127.0.0.1:30178/academate>
- OMP Web 原页面：<http://127.0.0.1:30178/>
- Paper Claw 健康检查：<http://127.0.0.1:8000/api/ready>
- AcadMate 后端健康检查：<http://127.0.0.1:3001/api/health>

## 本地测试账号

- 邮箱：`ompweb-adapter-test@local.invalid`
- 密码：`AdapterTest2026!`

这是之前为本机联调创建的测试账号，不是你的个人账号。它没有配置模型 API Key；要测试真实模型回复，请登录后在页面的模型设置中填写自己的配置。此备忘包含明文测试密码，不要将其用于正式环境或公开发布。

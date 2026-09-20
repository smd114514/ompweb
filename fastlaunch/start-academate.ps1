[CmdletBinding()]
param(
    [ValidateSet('all', 'fastapi', 'express', 'web')]
    [string]$Service = 'all'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ompRoot = Split-Path -Parent $PSScriptRoot
$githubRoot = Split-Path -Parent $ompRoot
$acadRoot = Join-Path $githubRoot 'AcadMate'
$paperRoot = Join-Path $acadRoot 'paper-claw-master'
$codeRoot = Join-Path $acadRoot 'Code'
$uvicornExe = Join-Path $paperRoot 'backend\.venv\Scripts\uvicorn.exe'
$alembicExe = Join-Path $paperRoot 'backend\.venv\Scripts\alembic.exe'
$dockerCli = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe'
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue | Select-Object -First 1
$npmCmd = if ($npmCommand) { $npmCommand.Source } else { 'D:\node\npm.cmd' }

if ($Service -ne 'all') {
    switch ($Service) {
        'fastapi' {
            Set-Location $paperRoot
            & $uvicornExe backend.api.app:create_app --factory --host 127.0.0.1 --port 8000
        }
        'express' {
            Set-Location $codeRoot
            & $npmCmd run dev:backend
        }
        'web' {
            Set-Location $ompRoot
            & $npmCmd run dev
        }
    }
    exit $LASTEXITCODE
}

foreach ($requiredPath in @($paperRoot, $codeRoot, $dockerCli, $uvicornExe, $alembicExe, $npmCmd)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Missing required path: $requiredPath"
    }
}

function Test-HttpReady {
    param([string]$Url)
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
        return [int]$response.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Test-PortOpen {
    param([int]$Port)
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $client.Connect('127.0.0.1', $Port)
        return $true
    } catch {
        return $false
    } finally {
        $client.Dispose()
    }
}

function Wait-For {
    param(
        [string]$Label,
        [scriptblock]$Check,
        [int]$TimeoutSeconds,
        [System.Diagnostics.Process]$Process = $null
    )
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (& $Check) {
            Write-Host "$Label ready."
            return
        }
        if ($Process -and $Process.HasExited) {
            throw "$Label exited before becoming ready."
        }
        Start-Sleep -Seconds 2
    }
    throw "$Label did not become ready within $TimeoutSeconds seconds."
}

function Test-DockerReady {
    try {
        & $dockerCli version --format '{{.Server.Version}}' *> $null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Test-PostgresReady {
    try {
        & $dockerCli compose exec -T postgres pg_isready -U paper_claw -d paper_claw *> $null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

$logDir = Join-Path $env:LOCALAPPDATA 'AcadMateFastLaunch\logs'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$powerShellExe = Join-Path $PSHOME 'powershell.exe'
if (-not (Test-Path -LiteralPath $powerShellExe)) {
    $powerShellExe = Join-Path $PSHOME 'pwsh.exe'
}

function Start-App {
    param(
        [string]$Name,
        [string]$Url,
        [int]$Port,
        [int]$TimeoutSeconds
    )
    if (Test-HttpReady $Url) {
        Write-Host "$Name already running."
        return
    }
    if (Test-PortOpen $Port) {
        throw "$Name port $Port is in use, but $Url is not healthy. Check the existing process."
    }

    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
    $stdoutLog = Join-Path $logDir "$Name-$stamp.out.log"
    $stderrLog = Join-Path $logDir "$Name-$stamp.err.log"
    $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $PSCommandPath + '"'), '-Service', $Name)
    $process = Start-Process -FilePath $powerShellExe -ArgumentList $arguments -WorkingDirectory $ompRoot -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru
    Write-Host "Starting $Name (PID $($process.Id)); logs: $stdoutLog / $stderrLog"
    Wait-For $Name { Test-HttpReady $Url } $TimeoutSeconds $process
}

if (-not (Test-DockerReady)) {
    Write-Host 'Starting Docker Desktop...'
    & $dockerCli desktop start
    if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop failed to start.' }
}
Wait-For 'Docker Engine' { Test-DockerReady } 120

Set-Location $paperRoot
Write-Host 'Starting PostgreSQL container...'
& $dockerCli compose up -d
if ($LASTEXITCODE -ne 0) { throw 'docker compose up failed.' }
Wait-For 'PostgreSQL' { Test-PostgresReady } 120

Write-Host 'Applying database migrations...'
& $alembicExe -c backend/alembic.ini upgrade head
if ($LASTEXITCODE -ne 0) { throw 'Database migration failed.' }

Start-App 'fastapi' 'http://127.0.0.1:8000/api/ready' 8000 120
Start-App 'express' 'http://127.0.0.1:3001/api/health' 3001 90
Start-App 'web' 'http://127.0.0.1:30178/academate' 30178 120

Write-Host ''
Write-Host 'AcadMate is ready: http://127.0.0.1:30178/academate'
Write-Host "Service logs: $logDir"

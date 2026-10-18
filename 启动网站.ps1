$ErrorActionPreference = 'Stop'
$studioRoot = $PSScriptRoot
. (Join-Path $studioRoot '后台启动.ps1')
try { $null = Invoke-RestMethod -Uri 'http://127.0.0.1:4173/api/status' -TimeoutSec 3 }
catch {
  if (Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue) { throw '4173 端口被其他程序占用，未重复启动。' }
  $studioNode = (Get-Command node -ErrorAction SilentlyContinue).Source
  if (-not $studioNode) {
    # Node is not always on PATH; try the runtimes this machine has actually used.
    $studioNodeCandidates = @(
      (Join-Path $env:USERPROFILE '.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'),
      (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe')
    )
    $studioNode = $studioNodeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  }
  if (-not $studioNode) { throw '未找到 Node.js（需要 22 或更新版本）。请安装 Node 或把 node.exe 加入 PATH。' }
  $studioProcessId = Start-StudioBackground -Executable $studioNode -Arguments @((Join-Path $studioRoot 'server.mjs')) -Directory $studioRoot
  New-Item -ItemType Directory -Path (Join-Path $studioRoot '.share') -Force | Out-Null
  Set-Content -LiteralPath (Join-Path $studioRoot '.share\website.pid') -Value $studioProcessId
  $studioReady = $false
  for ($studioAttempt = 0; $studioAttempt -lt 10; $studioAttempt++) {
    try { $null = Invoke-RestMethod -Uri 'http://127.0.0.1:4173/api/status' -TimeoutSec 2; $studioReady = $true; break } catch { Start-Sleep -Milliseconds 500 }
  }
  if (-not $studioReady) { throw '网站未能正常启动，请确认仍使用保存 API 配置时的 Windows 账户。' }
}
$studioWatchFile = Join-Path $studioRoot 'start-website-watch.ps1'
$studioWatchProcess = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like ('*'+$studioWatchFile+'*') }
if ((Test-Path -LiteralPath $studioWatchFile) -and -not $studioWatchProcess) {
  $null = Start-StudioBackground -Executable (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -Arguments @('-NoProfile','-ExecutionPolicy','Bypass','-File',$studioWatchFile) -Directory $studioRoot
}
Write-Host '织景网站已在后台运行：http://127.0.0.1:4173/'
Write-Host '现在可以关闭启动窗口；已保存的 API 配置会自动加载。'

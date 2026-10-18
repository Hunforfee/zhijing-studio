param([switch]$Quiet)
$ErrorActionPreference = 'Stop'
$shareRoot = $PSScriptRoot
. (Join-Path $shareRoot '后台启动.ps1')
$shareRuntime = Join-Path $shareRoot '.share'
$shareNode = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $shareNode) {
  # Node is not always on PATH; try the runtimes this machine has actually used.
  $shareNode = @(
    (Join-Path $env:USERPROFILE '.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'),
    (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe')
  ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $shareNode) { throw '未找到 Node.js，请先安装 Node.js 22 或更新版本。' }
New-Item -ItemType Directory -Path $shareRuntime -Force | Out-Null
try { $null = Invoke-RestMethod -Uri 'http://127.0.0.1:4173/api/status' -TimeoutSec 3 }
catch {
  & (Join-Path $shareRoot '启动网站.ps1')
}
try {
  $shareProbe = Invoke-WebRequest -Uri 'http://127.0.0.1:4174/' -UseBasicParsing -TimeoutSec 3
  $shareGatewayReady = $shareProbe.StatusCode -eq 403
} catch { $shareGatewayReady = $_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 403 }
if (-not $shareGatewayReady) {
  $shareGatewayProcessId = Start-StudioBackground -Executable $shareNode -Arguments @((Join-Path $shareRoot 'share-server.mjs')) -Directory $shareRoot
  $shareGatewayProcessId | Set-Content -LiteralPath (Join-Path $shareRuntime 'gateway.pid')
}
$shareExisting = $null
try {
  $shareSavedPid = [int](Get-Content -LiteralPath (Join-Path $shareRuntime 'tunnel.pid'))
  $shareExisting = Get-Process -Id $shareSavedPid -ErrorAction Stop
  if ($shareExisting.Path -ne (Join-Path $shareRuntime 'cloudflared.exe')) { $shareExisting = $null }
} catch {}
$shareLog = Join-Path $shareRuntime 'tunnel-error.log'
if (Test-Path -LiteralPath (Join-Path $shareRuntime 'tunnel-log-path')) {
  $shareLogName = (Get-Content -LiteralPath (Join-Path $shareRuntime 'tunnel-log-path') -Raw).Trim()
  if ($shareLogName -match '^tunnel-\d+\.log$') { $shareLog = Join-Path $shareRuntime $shareLogName }
}
if ($shareExisting -and (Test-Path -LiteralPath $shareLog) -and ((Get-Content -LiteralPath $shareLog -Tail 10) -match 'Unauthorized: Tunnel not found')) {
  Stop-Process -Id $shareExisting.Id
  $shareExisting = $null
}
if (-not $shareExisting) {
  $shareLogName = 'tunnel-'+[DateTime]::UtcNow.Ticks+'.log'
  $shareLog = Join-Path $shareRuntime $shareLogName
  $shareTunnelProcessId = Start-StudioBackground -Executable (Join-Path $shareRuntime 'cloudflared.exe') -Arguments @('tunnel','--url','http://127.0.0.1:4174','--protocol','http2','--no-autoupdate','--logfile',$shareLog) -Directory $shareRoot
  $shareTunnelProcessId | Set-Content -LiteralPath (Join-Path $shareRuntime 'tunnel.pid')
  $shareLogName | Set-Content -LiteralPath (Join-Path $shareRuntime 'tunnel-log-path')
}
$shareAddress = $null
for ($shareAttempt = 0; $shareAttempt -lt 30; $shareAttempt++) {
  if (Test-Path -LiteralPath $shareLog) {
    $shareMatch = [regex]::Match((Get-Content -LiteralPath $shareLog -Raw),'https://[a-z0-9-]+\.trycloudflare\.com')
    if ($shareMatch.Success -and (Test-Path -LiteralPath (Join-Path $shareRuntime 'invite-token'))) { $shareAddress = $shareMatch.Value; break }
  }
  Start-Sleep -Seconds 1
}
if (-not $shareAddress) { throw '尚未获得公网地址，请查看 .share 中的连接日志后重试。' }
$shareAddress | Set-Content -LiteralPath (Join-Path $shareRuntime 'public-origin')
$shareInvitation = $shareAddress+'/invite/'+(Get-Content -LiteralPath (Join-Path $shareRuntime 'invite-token') -Raw).Trim()
$shareInvitation | Set-Content -LiteralPath (Join-Path $shareRuntime '分享链接.txt')
if (-not $Quiet) {
  Write-Host '将以下完整邀请链接发给朋友：'
  Write-Host $shareInvitation
}
Write-Host '完整邀请链接已更新到 .share\分享链接.txt；生成服务继续使用本机保存的配置。'

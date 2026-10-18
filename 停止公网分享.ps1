$ErrorActionPreference = 'Stop'
$shareRuntime = Join-Path $PSScriptRoot '.share'
foreach ($shareKind in @('tunnel','gateway')) {
  $sharePidFile = Join-Path $shareRuntime ($shareKind+'.pid')
  if (-not (Test-Path -LiteralPath $sharePidFile)) { continue }
  $shareSavedPid = [int](Get-Content -LiteralPath $sharePidFile)
  $shareProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$shareSavedPid"
  if (-not $shareProcess) { continue }
  $shareOwned = if ($shareKind -eq 'tunnel') { $shareProcess.ExecutablePath -eq (Join-Path $shareRuntime 'cloudflared.exe') } else { $shareProcess.CommandLine -like ('*'+(Join-Path $PSScriptRoot 'share-server.mjs')+'*') }
  if ($shareOwned) { Stop-Process -Id $shareSavedPid }
}
Write-Host '公网分享已停止，本地网站仍可使用。'

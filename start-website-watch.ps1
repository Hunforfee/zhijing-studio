$ErrorActionPreference = 'Stop'
$siteRoot = $PSScriptRoot
New-Item -ItemType Directory -Path (Join-Path $siteRoot '.share') -Force | Out-Null
$nodeExe = 'C:\Users\Hunfo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$watchMutex = New-Object System.Threading.Mutex($false, 'Local\HunfoZhijingWebsiteWatch')
if (-not $watchMutex.WaitOne(0)) { exit }
try {
    while ($true) {
        $siteHealthy = $false
        try {
            $response = Invoke-WebRequest -Uri 'http://127.0.0.1:4173/api/status' -UseBasicParsing -TimeoutSec 5
            $siteHealthy = $response.StatusCode -eq 200
        } catch {}
        if (-not $siteHealthy) {
          try {
            $runningSite = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match '(?:^|[\s"\\/])server\.mjs(?:[\s"]|$)' -and $_.ExecutablePath -eq $nodeExe }
            if (-not $runningSite -and -not (Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue)) {
                $siteProcess = Start-Process -FilePath $nodeExe -ArgumentList 'server.mjs' -WorkingDirectory $siteRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $siteRoot '.share/website.log') -RedirectStandardError (Join-Path $siteRoot '.share/website-error.log') -PassThru
                $siteProcess.Id | Set-Content -LiteralPath (Join-Path $siteRoot '.share/website.pid')
            }
          } catch {
            Add-Content -LiteralPath (Join-Path $siteRoot '.share/website-watch.log') -Value ((Get-Date -Format 's') + ' ' + $_.Exception.Message)
          }
        }
        Start-Sleep -Seconds 30
    }
} finally {
    $watchMutex.ReleaseMutex()
    $watchMutex.Dispose()
}

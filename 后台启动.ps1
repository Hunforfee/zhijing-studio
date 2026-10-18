function Start-StudioBackground {
  param([string]$Executable,[string[]]$Arguments,[string]$Directory)
  if (-not (Test-Path -LiteralPath $Executable)) { throw '后台程序不存在。' }
  # Run independently of the starting terminal, under the current Windows user.
  $studioStartup = New-CimInstance -CimClass (Get-CimClass -ClassName Win32_ProcessStartup) -ClientOnly -Property @{ShowWindow=[uint16]0}
  $studioCommand = (@($Executable)+$Arguments | ForEach-Object {
    if ($_ -match '"') { throw '启动参数不能包含双引号。' }
    '"'+$_+'"'
  }) -join ' '
  $studioResult = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine=$studioCommand;CurrentDirectory=$Directory;ProcessStartupInformation=$studioStartup}
  if ($studioResult.ReturnValue -ne 0) { throw ('后台启动失败：'+$studioResult.ReturnValue) }
  return [int]$studioResult.ProcessId
}

param(
  [Parameter(Mandatory=$true)][ValidateSet('running','stopped','terminate-java','no-java')][string]$Mode,
  [Parameter(Mandatory=$true)][string]$InstallationDirectory,
  [int]$ParentProcessId
)
$ErrorActionPreference = 'Stop'
$prefix = (Resolve-Path -LiteralPath $InstallationDirectory).Path.TrimEnd('\') + '\'
function Get-OwnedProcesses {
  @(Get-CimInstance Win32_Process | Where-Object {
    $_.ExecutablePath -and $_.ExecutablePath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)
  })
}
if ($Mode -eq 'stopped') {
  $deadline = (Get-Date).AddSeconds(35)
  do {
    $owned = @(Get-OwnedProcesses)
    if (-not $owned.Count) { break }
    Start-Sleep -Milliseconds 250
  } while ((Get-Date) -lt $deadline)
  if ($owned.Count) { throw 'Processes remain in the isolated package after close. No process was killed by this helper.' }
  @{ processesExited=$true } | ConvertTo-Json -Compress
  exit
}
$owned = @(Get-OwnedProcesses)
$java = @($owned | Where-Object { $_.Name -eq 'java.exe' })
if ($Mode -eq 'no-java') {
  if ($java.Count) { throw 'Unexpected Java process after the isolated backend crash.' }
  if (-not ($owned | Where-Object { $_.ProcessId -eq $ParentProcessId })) { throw 'Expected the isolated Electron main to remain for the alert.' }
  @{ noJavaProcess=$true; mainStillRunning=$true } | ConvertTo-Json -Compress
  exit
}
if ($java.Count -ne 1 -or $java[0].ParentProcessId -ne $ParentProcessId) {
  throw 'Expected exactly one bundled Java child of the tested Electron main.'
}
$processorBudget = [regex]::Match($java[0].CommandLine, '(?:^|\s)-XX:ActiveProcessorCount=([12])(?:\s|$)')
if ($java[0].CommandLine -notmatch '(?:^|\s)-Xms32m(?:\s|$)' -or
    $java[0].CommandLine -notmatch '(?:^|\s)-Xmx512m(?:\s|$)' -or -not $processorBudget.Success) {
  throw 'Expected the bounded desktop JVM heap and internal processor budget.'
}
$listeners = @(Get-NetTCPConnection -OwningProcess $java[0].ProcessId | Where-Object { $_.RemotePort -eq 0 })
if ($listeners.Count -ne 1 -or $listeners[0].LocalAddress -ne '127.0.0.1') {
  throw 'Expected exactly one loopback backend listener.'
}
if ($Mode -eq 'terminate-java') {
  $installation = $prefix.TrimEnd('\')
  $fixtureRoot = [System.IO.Path]::GetDirectoryName($installation)
  if ([System.IO.Path]::GetFileName($fixtureRoot) -notlike 'jbstock-packaged-*' -or
      $java[0].ExecutablePath -ne (Join-Path $installation 'resources\runtime\bin\java.exe')) {
    throw 'Refusing to terminate Java outside the named packaged-test fixture.'
  }
  Stop-Process -Id $java[0].ProcessId -Force
  @{ terminatedJavaProcessId=$java[0].ProcessId; backendPort=$listeners[0].LocalPort } | ConvertTo-Json -Compress
  exit
}
@{ processIds=@($owned.ProcessId); javaProcessId=$java[0].ProcessId; backendPort=$listeners[0].LocalPort;
  javaHeapLimitMiB=512; javaInitialHeapMiB=32; jvmProcessorCount=[int]$processorBudget.Groups[1].Value } | ConvertTo-Json -Compress

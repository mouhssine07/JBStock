param([Parameter(Mandatory=$true)][string]$ReportPath)
$ErrorActionPreference = 'Stop'
$package = Get-AppxPackage -Name JBStock.Development
if (-not $package) { throw 'Development package is not installed.' }
$prefix = $package.InstallLocation.TrimEnd('\') + '\'
$owned = @(Get-CimInstance Win32_Process | Where-Object {
  $_.ExecutablePath -and $_.ExecutablePath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)
})
$java = @($owned | Where-Object { $_.Name -eq 'java.exe' })
if ($java.Count -ne 1) { throw "Expected one packaged Java process, found $($java.Count)." }
# Some Windows builds report an empty State for these endpoints. Match the owned
# bound endpoints, then prove readiness by HTTP and closure by a TCP connection.
$listeners = @(Get-NetTCPConnection | Where-Object { $_.OwningProcess -in $owned.ProcessId -and $_.RemotePort -eq 0 })
$backendListeners = @($listeners | Where-Object { $_.OwningProcess -eq $java[0].ProcessId })
if ($backendListeners.Count -ne 1 -or $backendListeners[0].LocalAddress -ne '127.0.0.1') {
  throw 'Expected one loopback backend listener.'
}
$health = Invoke-RestMethod -Uri ('http://127.0.0.1:' + $backendListeners[0].LocalPort + '/health') -TimeoutSec 10
if ($health.status -ne 'UP') { throw 'Backend health check failed.' }
$windows = @($owned | Where-Object { $_.Name -eq 'JBStock.exe' } |
  ForEach-Object { Get-Process -Id $_.ProcessId } | Where-Object { $_.MainWindowHandle -ne 0 })
if ($windows.Count -ne 1) { throw "Expected one JBStock window, found $($windows.Count)." }
if (-not $windows[0].CloseMainWindow()) { throw 'Graceful window close was rejected.' }
$deadline = (Get-Date).AddSeconds(40)
do {
  $remaining = @($owned.ProcessId | ForEach-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue })
  if (-not $remaining.Count) { break }
  Start-Sleep -Milliseconds 250
} while ((Get-Date) -lt $deadline)
if ($remaining.Count) { throw 'Owned processes remain after close; no forced termination performed.' }
foreach ($port in $listeners.LocalPort) {
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    try { $connection = $client.ConnectAsync('127.0.0.1', $port); $null = $connection.Wait(1500) } catch {}
    if ($client.Connected) { throw "Tested port $port remains reachable after close." }
  } finally { $client.Dispose() }
}
$storage = Join-Path $env:LOCALAPPDATA ('Packages\' + $package.PackageFamilyName + '\LocalCache\Local\JBStock')
$database = Join-Path $storage 'data\jbstock.db'
if (-not (Test-Path -LiteralPath $database)) { throw 'Expected virtualized database not found.' }
$log = Get-Content -LiteralPath (Join-Path $storage 'logs\jbstock.log') -Raw
if ($log.TrimEnd() -notmatch 'LOGGING_STOPPED$') { throw 'Final graceful backend shutdown log missing.' }
[pscustomobject]@{
  version=$package.Version.ToString(); family=$package.PackageFamilyName; storage=$storage;
  processIds=@($owned.ProcessId); backendPort=$backendListeners[0].LocalPort;
  testedPorts=@($listeners.LocalPort); processesExited=$true; portsClosed=$true;
  shutdownCount=([regex]::Matches($log, 'LOGGING_STOPPED')).Count;
  databaseSha256=(Get-FileHash -LiteralPath $database -Algorithm SHA256).Hash
} | ConvertTo-Json | Set-Content -LiteralPath $ReportPath -Encoding UTF8
Get-Content -LiteralPath $ReportPath

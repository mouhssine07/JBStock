param(
  [Parameter(Mandatory=$true)][int]$JavaProcessId,
  [Parameter(Mandatory=$true)][string]$OutputPath
)
$ErrorActionPreference = 'Stop'
$peakWorkingSet = 0L
$peakPrivate = 0L
$peakThreads = 0
$cpuMs = 0.0
$samples = 0
while ($true) {
  try { $javaProcess = Get-Process -Id $JavaProcessId -ErrorAction Stop } catch { break }
  try {
    if ($javaProcess.HasExited) { break }
    $peakWorkingSet = [Math]::Max($peakWorkingSet, $javaProcess.PeakWorkingSet64)
    $peakPrivate = [Math]::Max($peakPrivate, $javaProcess.PrivateMemorySize64)
    $peakThreads = [Math]::Max($peakThreads, $javaProcess.Threads.Count)
    $cpuMs = [Math]::Max($cpuMs, $javaProcess.TotalProcessorTime.TotalMilliseconds)
    $samples++
  } catch { break } finally { $javaProcess.Dispose() }
  Start-Sleep -Milliseconds 50
}
@{ peakWorkingSetBytes=$peakWorkingSet; sampledPeakPrivateBytes=$peakPrivate;
   sampledPeakThreads=$peakThreads; observedCpuMs=$cpuMs; samples=$samples } |
  ConvertTo-Json | Set-Content -LiteralPath $OutputPath -Encoding UTF8

param([Parameter(Mandatory=$true)][string]$DatabasePath)
$ErrorActionPreference = 'Stop'
# Test fixture only. Hold an existing file without modifying its bytes or permissions.
$handle = [System.IO.File]::Open($DatabasePath, [System.IO.FileMode]::Open,
  [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
try {
  [Console]::WriteLine('DB_LOCKED')
  [Console]::Out.Flush()
  [Console]::ReadLine() | Out-Null
} finally { $handle.Dispose() }

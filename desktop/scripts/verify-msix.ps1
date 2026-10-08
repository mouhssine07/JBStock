param(
  [string]$PackagePath,
  [string]$ExpectedIdentity = 'JBStock.Development',
  [string]$ExpectedVersion
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$desktopRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$metadata = Get-Content -LiteralPath (Join-Path $desktopRoot 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $ExpectedVersion) { $ExpectedVersion = $metadata.version + '.0' }
if (-not $PackagePath) {
  $PackagePath = Join-Path $desktopRoot ("release\JBStock.Development-{0}.0-x64.msix" -f $metadata.version)
}
$archive = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $PackagePath).Path)
try {
  $manifestEntry = $archive.GetEntry('AppxManifest.xml')
  if (-not $manifestEntry) { throw 'AppxManifest.xml missing.' }
  $reader = [System.IO.StreamReader]::new($manifestEntry.Open())
  try { [xml]$manifest = $reader.ReadToEnd() } finally { $reader.Dispose() }
  if ($manifest.Package.Identity.Name -ne $ExpectedIdentity -or
      $manifest.Package.Identity.Version -ne $ExpectedVersion -or
      $manifest.Package.Identity.ProcessorArchitecture -ne 'x64') { throw 'Unexpected identity/version/architecture.' }
  if ($manifest.Package.Applications.Application.Executable -ne 'app\JBStock.exe' -or
      $manifest.Package.Applications.Application.EntryPoint -ne 'Windows.FullTrustApplication') { throw 'Invalid desktop entry point.' }
  $capabilities = @($manifest.Package.Capabilities.ChildNodes | Where-Object { $_.NodeType -eq 'Element' })
  if ($capabilities.Count -ne 1 -or $capabilities[0].Name -ne 'runFullTrust') { throw 'Unexpected capabilities.' }
  if (-not $archive.GetEntry('AppxBlockMap.xml')) { throw 'MSIX block map missing.' }
  foreach ($asset in @('StoreLogo.png', 'Square44x44Logo.png', 'Square150x150Logo.png')) {
    if (-not $archive.GetEntry('Assets/' + $asset)) { throw "Missing logo: $asset" }
  }
  $source = Join-Path $desktopRoot 'release\win-unpacked'
  $sourceFiles = @(Get-ChildItem -LiteralPath $source -File -Recurse)
  $payload = @($archive.Entries | Where-Object { $_.FullName.StartsWith('app/') })
  if ($sourceFiles.Count -ne $payload.Count) { throw 'Packaged payload file count differs from win-unpacked.' }
  foreach ($file in $sourceFiles) {
    $relative = $file.FullName.Substring($source.Length + 1).Replace('\', '/')
    $entry = $archive.GetEntry('app/' + $relative)
    if (-not $entry -or $entry.Length -ne $file.Length) { throw "Missing or truncated payload: $relative" }
    $stream = $entry.Open()
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { $actual = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '') }
    finally { $stream.Dispose(); $sha.Dispose() }
    if ($actual -ne (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash) { throw "Payload hash differs: $relative" }
  }
  Write-Host "MSIX verified: identity, desktop entry point, capability, assets, block map, $($sourceFiles.Count) identical payload files (SHA-256)."
  Write-Host 'This verifies assembly only, not installation, execution, updates or Store certification.'
} finally { $archive.Dispose() }

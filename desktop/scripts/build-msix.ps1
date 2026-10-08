param(
  [switch]$TestIdentity,
  [string]$IdentityFile,
  [string]$AssetsDirectory,
  [string]$MakeAppxPath,
  [UInt16]$TestRevision = 0,
  [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$desktopRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ($TestRevision -ne 0 -and -not $TestIdentity) { throw 'TestRevision is reserved for development packages.' }
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $desktopRoot 'release' }
$OutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
if ($TestIdentity -and $IdentityFile) { throw 'Choose TestIdentity or IdentityFile, not both.' }
if (-not $TestIdentity -and -not $IdentityFile) { throw 'Provide -TestIdentity or -IdentityFile with Partner Center values.' }
if ($TestIdentity) {
  $identity = [pscustomobject]@{ name='JBStock.Development'; publisher='CN=JBStock Development'; publisherDisplayName='JBStock Development'; displayName='JBStock Development' }
} else {
  $identity = Get-Content -LiteralPath $IdentityFile -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach ($field in @('name', 'publisher', 'publisherDisplayName', 'displayName')) {
    if ([string]::IsNullOrWhiteSpace($identity.$field) -or $identity.$field -match 'REPLACE-WITH|JBStock\.Development|JBStock Development') {
      throw "Missing or placeholder Store identity field: $field"
    }
  }
  if (-not $AssetsDirectory) { throw 'Store identity requires -AssetsDirectory with final logos.' }
}
if ($identity.name -notmatch '^[A-Za-z0-9.-]{3,50}$') { throw 'Invalid MSIX identity name.' }
if ($identity.publisher -notmatch '^CN=') { throw 'Publisher must be the full certificate subject (CN=...).'}
$package = Get-Content -LiteralPath (Join-Path $desktopRoot 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($package.version -notmatch '^\d+\.\d+\.\d+$') { throw 'MSIX requires a stable three-part package.json version.' }
$version = $package.version + '.' + $TestRevision
foreach ($part in $version.Split('.')) { if ([long]$part -gt 65535) { throw 'MSIX version component exceeds 65535.' } }
$source = Join-Path $desktopRoot 'release\win-unpacked'
foreach ($file in @('JBStock.exe', 'resources\app.asar', 'resources\runtime\bin\java.exe', 'resources\backend\jbstock.jar', 'resources\frontend\index.html')) {
  if (-not (Test-Path -LiteralPath (Join-Path $source $file) -PathType Leaf)) { throw "Missing packaged resource: $file. Run build:windows:dir first." }
}
if (-not $MakeAppxPath) {
  $sdkRoot = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'
  $MakeAppxPath = Get-ChildItem -LiteralPath $sdkRoot -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^10\.0\.\d+\.0$' } | Sort-Object { [version]$_.Name } -Descending |
    ForEach-Object { Join-Path $_.FullName 'x64\makeappx.exe' } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $MakeAppxPath -or -not (Test-Path -LiteralPath $MakeAppxPath -PathType Leaf)) { throw 'Install Windows SDK or pass -MakeAppxPath.' }

# A unique build directory avoids deleting other build runs or user data.
$buildParent = Join-Path $desktopRoot '.build\msix'
$work = Join-Path $buildParent ([guid]::NewGuid().ToString('N'))
$assets = Join-Path $work 'Assets'
New-Item -ItemType Directory -Path $assets -Force | Out-Null
try {
  $logos = @{ 'StoreLogo.png'=50; 'Square44x44Logo.png'=44; 'Square150x150Logo.png'=150 }
  Add-Type -AssemblyName System.Drawing
  foreach ($name in $logos.Keys) {
    $size = $logos[$name]
    $destination = Join-Path $assets $name
    if ($AssetsDirectory) {
      Copy-Item -LiteralPath (Join-Path $AssetsDirectory $name) -Destination $destination
    } else {
      # Geometric placeholders for development only; never used for Store identity.
      $bitmap = New-Object System.Drawing.Bitmap($size, $size)
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#16324F'))
        $graphics.FillRectangle([System.Drawing.Brushes]::White, [int]($size*.22), [int]($size*.25), [int]($size*.56), [int]($size*.18))
        $graphics.FillRectangle([System.Drawing.Brushes]::White, [int]($size*.22), [int]($size*.55), [int]($size*.56), [int]($size*.18))
        $bitmap.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
      } finally { $graphics.Dispose(); $bitmap.Dispose() }
    }
    $logo = [System.Drawing.Image]::FromFile($destination)
    try { if ($logo.Width -ne $size -or $logo.Height -ne $size) { throw "$name must be ${size}x${size}." } }
    finally { $logo.Dispose() }
  }
  [xml]$manifest = Get-Content -LiteralPath (Join-Path $desktopRoot 'msix\AppxManifest.xml') -Raw -Encoding UTF8
  $manifest.Package.Identity.SetAttribute('Name', $identity.name)
  $manifest.Package.Identity.SetAttribute('Publisher', $identity.publisher)
  $manifest.Package.Identity.SetAttribute('Version', $version)
  $manifest.Package.Properties.DisplayName = $identity.displayName
  $manifest.Package.Properties.PublisherDisplayName = $identity.publisherDisplayName
  $manifest.Package.Applications.Application.VisualElements.SetAttribute('DisplayName', $identity.displayName)
  $manifestPath = Join-Path $work 'AppxManifest.xml'
  $manifest.Save($manifestPath)
  $mapping = [System.Collections.Generic.List[string]]::new()
  $mapping.Add('[Files]')
  $mapping.Add(('"{0}" "AppxManifest.xml"' -f $manifestPath))
  foreach ($name in $logos.Keys) { $mapping.Add(('"{0}" "Assets\{1}"' -f (Join-Path $assets $name), $name)) }
  foreach ($file in Get-ChildItem -LiteralPath $source -Recurse -File) {
    $relative = $file.FullName.Substring($source.Length + 1)
    if ($file.Extension -in @('.db', '.sqlite', '.sqlite3', '.log', '.pfx')) { throw "Unexpected user data or key in application payload: $relative" }
    $mapping.Add(('"{0}" "app\{1}"' -f $file.FullName, $relative))
  }
  $mappingPath = Join-Path $work 'mapping.txt'
  [System.IO.File]::WriteAllLines($mappingPath, $mapping, [System.Text.UTF8Encoding]::new($false))
  $temporaryPackage = Join-Path $work 'package.msix'
  $packLog = Join-Path $work 'makeappx.log'
  & $MakeAppxPath pack /f $mappingPath /p $temporaryPackage /o > $packLog
  if ($LASTEXITCODE -ne 0) {
    Get-Content -LiteralPath $packLog -Tail 20
    throw "MakeAppx failed: $LASTEXITCODE"
  }
  New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
  $artifact = Join-Path $OutputDirectory ("{0}-{1}-x64.msix" -f $identity.name, $version)
  # Commit atomically on the default volume; avoid the PowerShell Move-Item
  # overwrite path hanging on an existing artifact.
  if ([System.IO.File]::Exists($artifact)) {
    # Windows PowerShell converts a null string argument to an empty path.
    # Keep the previous artifact in this unique staging directory until cleanup.
    if ([string]::Equals([System.IO.Path]::GetPathRoot($temporaryPackage),
                        [System.IO.Path]::GetPathRoot($artifact), [StringComparison]::OrdinalIgnoreCase)) {
      [System.IO.File]::Replace($temporaryPackage, $artifact, (Join-Path $work 'previous.msix'))
    } else {
      # Preserve custom output directories on another volume (non-atomic copy).
      [System.IO.File]::Copy($temporaryPackage, $artifact, $true)
    }
  } else {
    [System.IO.File]::Move($temporaryPackage, $artifact)
  }
  Copy-Item -LiteralPath $manifestPath -Destination ($artifact + '.manifest.xml') -Force
  Get-FileHash -LiteralPath $artifact -Algorithm SHA256 | Select-Object Path,Hash
  Write-Host 'Unsigned MSIX built. Installation, update, clean Windows and Store certification still need validation.'
} finally {
  $resolvedWork = [System.IO.Path]::GetFullPath($work)
  $allowed = [System.IO.Path]::GetFullPath($buildParent) + '\'
  if (-not $resolvedWork.StartsWith($allowed, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Refusing cleanup outside MSIX staging.' }
  Remove-Item -LiteralPath $resolvedWork -Recurse -Force
}

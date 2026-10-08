param(
  [Parameter(Mandatory=$true)][string]$PackagePath,
  [Parameter(Mandatory=$true)][ValidatePattern('^[A-Fa-f0-9]{40}$')][string]$CertificateThumbprint,
  [string]$SignToolPath
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$package = (Resolve-Path -LiteralPath $PackagePath).Path
$archive = [System.IO.Compression.ZipFile]::OpenRead($package)
try {
  if ($archive.GetEntry('AppxSignature.p7x')) { throw 'Package already signed; provide an unsigned copy.' }
  $entry = $archive.GetEntry('AppxManifest.xml')
  if (-not $entry) { throw 'Missing manifest.' }
  $reader = [System.IO.StreamReader]::new($entry.Open())
  try { [xml]$manifest = $reader.ReadToEnd() } finally { $reader.Dispose() }
  if ($manifest.Package.Identity.Name -ne 'JBStock.Development' -or
      $manifest.Package.Identity.Publisher -ne 'CN=JBStock Development') {
    throw 'Only the JBStock development identity may be signed by this script.'
  }
} finally { $archive.Dispose() }

$certificate = Get-Item -LiteralPath ('Cert:\CurrentUser\My\' + $CertificateThumbprint)
if ($certificate.Subject -ne 'CN=JBStock Development' -or -not $certificate.HasPrivateKey -or
    $certificate.NotAfter -le (Get-Date) -or $certificate.NotBefore -gt (Get-Date)) {
  throw 'A valid development signing certificate with a private key is required.'
}
$codeSigningUsages = @($certificate.Extensions |
  Where-Object { $_.Oid.Value -eq '2.5.29.37' } |
  ForEach-Object { $_.EnhancedKeyUsages } | ForEach-Object { $_.Value })
if ('1.3.6.1.5.5.7.3.3' -notin $codeSigningUsages) {
  throw 'Certificate must allow code signing.'
}
if (-not $SignToolPath) {
  $sdkRoot = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'
  $SignToolPath = Get-ChildItem -LiteralPath $sdkRoot -Directory |
    Where-Object { $_.Name -match '^10\.0\.\d+\.0$' } | Sort-Object { [version]$_.Name } -Descending |
    ForEach-Object { Join-Path $_.FullName 'x64\signtool.exe' } |
    Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $SignToolPath) { throw 'Windows SDK SignTool is required.' }
$signed = Join-Path ([System.IO.Path]::GetDirectoryName($package)) ([System.IO.Path]::GetFileNameWithoutExtension($package) + '-signed.msix')
if (Test-Path -LiteralPath $signed) { throw 'Signed output already exists; refusing to overwrite it.' }
Copy-Item -LiteralPath $package -Destination $signed
& $SignToolPath sign /fd SHA256 /s My /sha1 $CertificateThumbprint $signed
if ($LASTEXITCODE -ne 0) { throw "SignTool failed: $LASTEXITCODE. Output must not be installed." }
Export-Certificate -Cert $certificate -FilePath ($signed + '.cer') -Type CERT | Out-Null
Get-FileHash -LiteralPath $signed -Algorithm SHA256 | Select-Object Path,Hash
Write-Host "Signed with certificate $CertificateThumbprint. No trust change or installation performed."

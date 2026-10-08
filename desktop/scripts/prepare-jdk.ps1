$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$toolsRoot = Join-Path $repoRoot '.tools'
$jdkRoot = Join-Path $toolsRoot 'microsoft-jdk21'
$archivePath = Join-Path $toolsRoot 'microsoft-jdk-21.0.12.1-windows-x64.zip'
$archiveUrl = 'https://aka.ms/download-jdk/microsoft-jdk-21.0.12.1-windows-x64.zip'
$checksumUrl = "$archiveUrl.sha256sum.txt"

New-Item -ItemType Directory -Force -Path $toolsRoot | Out-Null
$checksumOutput = & curl.exe -L --fail --silent --show-error $checksumUrl
if ($LASTEXITCODE -ne 0) { throw 'Impossible de lire la somme SHA-256 officielle Microsoft.' }
$expected = ([string]$checksumOutput -split '\s+')[0].ToUpperInvariant()
if ($expected -notmatch '^[A-F0-9]{64}$') { throw 'Le fichier de sommes Microsoft a un format inattendu.' }

if (-not (Test-Path -LiteralPath $archivePath -PathType Leaf)) {
  & curl.exe -L --fail --show-error --output $archivePath $archiveUrl
  if ($LASTEXITCODE -ne 0) { throw 'Le téléchargement du runtime Microsoft OpenJDK a échoué.' }
}
$actual = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
if ($actual -ne $expected) { throw "Somme SHA-256 incorrecte pour le JDK (attendue $expected, reçue $actual)." }

New-Item -ItemType Directory -Force -Path $jdkRoot | Out-Null
& tar.exe -xf $archivePath -C $jdkRoot
if ($LASTEXITCODE -ne 0) { throw 'Impossible de décompresser l’archive Microsoft OpenJDK.' }
$releaseFile = Join-Path $jdkRoot 'jdk-21.0.12.1+1\release'
if (-not (Test-Path -LiteralPath $releaseFile -PathType Leaf) -or
    -not (Select-String -LiteralPath $releaseFile -Pattern '^IMPLEMENTOR="Microsoft"$' -Quiet)) {
  throw 'L’archive extraite ne correspond pas au Microsoft OpenJDK 21.0.12.1 attendu.'
}
Write-Host "Microsoft OpenJDK 21.0.12.1 vérifié (SHA-256 $actual)."

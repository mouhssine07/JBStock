param(
  [string]$JdkHome = (Join-Path (Split-Path -Parent $PSScriptRoot) '..\.tools\microsoft-jdk21\jdk-21.0.12.1+1')
)

$ErrorActionPreference = 'Stop'
$desktopRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runtimeRoot = Join-Path $desktopRoot '.build\runtime'
$releaseFile = Join-Path $JdkHome 'release'
$jlink = Join-Path $JdkHome 'bin\jlink.exe'

if (-not (Test-Path -LiteralPath $releaseFile -PathType Leaf) -or -not (Test-Path -LiteralPath $jlink -PathType Leaf)) {
  throw "JDK Microsoft OpenJDK 21 introuvable dans '$JdkHome'. Décompressez l'archive officielle avant de construire le runtime."
}
if (-not (Select-String -LiteralPath $releaseFile -Pattern '^IMPLEMENTOR="Microsoft"$' -Quiet)) {
  throw 'Le runtime distribué doit provenir de Microsoft Build of OpenJDK ; le JDK sélectionné ne correspond pas.'
}
if (-not (Select-String -LiteralPath $releaseFile -Pattern '^JAVA_VERSION="21\.0\.12\.1"$' -Quiet)) {
  throw 'Le runtime doit utiliser Microsoft OpenJDK 21.0.12.1 ; mettez à jour le JDK local.'
}

# Conservative module set for Spring Boot, SQLite JDBC, TLS, and the Java launcher.
$modules = @(
  'java.base', 'java.compiler', 'java.datatransfer', 'java.desktop', 'java.instrument',
  'java.logging', 'java.management', 'java.naming', 'java.net.http', 'java.prefs',
  'java.rmi', 'java.scripting', 'java.security.jgss', 'java.sql', 'java.transaction.xa',
  'java.xml', 'jdk.crypto.ec', 'jdk.management', 'jdk.unsupported'
) -join ','

if (Test-Path -LiteralPath $runtimeRoot) {
  $resolvedRuntime = [System.IO.Path]::GetFullPath($runtimeRoot)
  $allowedParent = [System.IO.Path]::GetFullPath((Join-Path $desktopRoot '.build')) + [System.IO.Path]::DirectorySeparatorChar
  if (-not $resolvedRuntime.StartsWith($allowedParent, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refus de remplacer une cible hors de desktop/.build : $resolvedRuntime"
  }
  Remove-Item -LiteralPath $resolvedRuntime -Recurse -Force
}

& $jlink --add-modules $modules --bind-services --strip-debug --no-man-pages --no-header-files `
  --compress=2 --output $runtimeRoot
if ($LASTEXITCODE -ne 0) { throw "jlink a échoué avec le code $LASTEXITCODE." }

if (-not (Test-Path -LiteralPath (Join-Path $runtimeRoot 'bin\java.exe') -PathType Leaf) -or
    -not (Test-Path -LiteralPath (Join-Path $runtimeRoot 'legal') -PathType Container)) {
  throw 'Le runtime produit ne contient pas java.exe ou les notices de licence attendues.'
}
Write-Host "Runtime prêt : $runtimeRoot"

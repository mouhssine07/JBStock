param(
  [Parameter(Mandatory=$true)][string]$CertificatePath,
  [Parameter(Mandatory=$true)][ValidatePattern('^[A-Fa-f0-9]{40}$')][string]$ExpectedThumbprint
)
$ErrorActionPreference = 'Stop'
try {
  $certificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new(
    (Resolve-Path -LiteralPath $CertificatePath).Path)
  if ($certificate.Thumbprint -ne $ExpectedThumbprint -or
      $certificate.Subject -ne 'CN=JBStock Development' -or
      $certificate.NotAfter -le (Get-Date) -or $certificate.NotBefore -gt (Get-Date)) {
    throw 'Unexpected or expired development certificate.'
  }
  $principal = [System.Security.Principal.WindowsPrincipal][System.Security.Principal.WindowsIdentity]::GetCurrent()
  if (-not $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this trust step as administrator on the selected test computer.'
  }
  Import-Certificate -FilePath $CertificatePath -CertStoreLocation 'Cert:\LocalMachine\TrustedPeople' | Out-Null
  if (-not (Test-Path -LiteralPath ('Cert:\LocalMachine\TrustedPeople\' + $ExpectedThumbprint))) {
    throw 'Certificate trust could not be confirmed.'
  }
  Write-Output "Trusted development certificate: $ExpectedThumbprint"
} catch {
  Write-Error $_
  exit 1
}

param()
$ErrorActionPreference = 'Stop'
$desktopRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$output = Join-Path $desktopRoot 'release\msix-validation'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$record = Join-Path $output 'certificate.json'
if (Test-Path -LiteralPath $record) { throw 'Certificate record already exists; reuse its thumbprint instead of creating another key.' }
$certificate = New-SelfSignedCertificate -Type Custom -Subject 'CN=JBStock Development' `
  -FriendlyName 'JBStock MSIX development test' -CertStoreLocation 'Cert:\CurrentUser\My' `
  -KeyAlgorithm RSA -KeyLength 2048 -HashAlgorithm SHA256 -KeyUsage DigitalSignature `
  -KeyExportPolicy NonExportable -NotAfter (Get-Date).AddDays(90) `
  -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3', '2.5.29.19={text}')
$publicCertificate = Join-Path $output ($certificate.Thumbprint + '.cer')
Export-Certificate -Cert $certificate -FilePath $publicCertificate -Type CERT | Out-Null
[pscustomobject]@{
  subject = $certificate.Subject
  thumbprint = $certificate.Thumbprint
  expires = $certificate.NotAfter.ToString('o')
  signingAccount = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  publicCertificate = $publicCertificate
} | ConvertTo-Json | Set-Content -LiteralPath $record -Encoding UTF8
Get-Content -LiteralPath $record
Write-Host 'Private key stays non-exportable in CurrentUser/My. No trust change or installation performed.'

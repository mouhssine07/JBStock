param([ValidateRange(1024,65535)][int]$DebugPort = 9337)
$ErrorActionPreference = 'Stop'
$package = Get-AppxPackage -Name JBStock.Development
if (-not $package) { throw 'JBStock.Development is not installed for this account.' }
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[ComImport, Guid("2e941141-7f97-4756-ba1d-9decde894a3d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IJBStockActivationManager {
  [PreserveSig] int ActivateApplication([MarshalAs(UnmanagedType.LPWStr)] string appId,
    [MarshalAs(UnmanagedType.LPWStr)] string arguments, uint options, out uint processId);
}
public static class JBStockActivation {
  public static uint Launch(string appId, string arguments) {
    var type = Type.GetTypeFromCLSID(new Guid("45ba127d-10a8-46ea-8ab7-56ea9078943c"));
    var manager = (IJBStockActivationManager)Activator.CreateInstance(type);
    try {
      uint processId;
      Marshal.ThrowExceptionForHR(manager.ActivateApplication(appId, arguments, 0, out processId));
      return processId;
    } finally { Marshal.ReleaseComObject(manager); }
  }
}
'@
# Test only: debug access is loopback and lasts only for this launch.
$applicationPid = [JBStockActivation]::Launch(($package.PackageFamilyName + '!JBStock'),
  "--remote-debugging-address=127.0.0.1 --remote-debugging-port=$DebugPort")
[pscustomobject]@{ processId=$applicationPid; version=$package.Version.ToString();
  family=$package.PackageFamilyName; installLocation=$package.InstallLocation; debugPort=$DebugPort } | ConvertTo-Json

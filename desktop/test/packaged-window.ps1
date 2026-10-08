param(
  [Parameter(Mandatory=$true)][ValidateSet('minimize','restored')][string]$Mode,
  [Parameter(Mandatory=$true)][int]$ProcessId,
  [long]$ExpectedHandle
)
$ErrorActionPreference = 'Stop'
Add-Type @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class PackagedWindow {
  public delegate bool Visitor(IntPtr handle, IntPtr parameter);
  [DllImport("user32.dll")] static extern bool EnumWindows(Visitor callback, IntPtr parameter);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr handle, out uint processId);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr handle);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr handle);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr handle, int command);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  public static IntPtr[] VisibleWindows(int processId) {
    var windows = new List<IntPtr>();
    EnumWindows((handle, parameter) => {
      uint owner; GetWindowThreadProcessId(handle, out owner);
      if (owner == processId && IsWindowVisible(handle)) windows.Add(handle);
      return true;
    }, IntPtr.Zero);
    return windows.ToArray();
  }
}
'@
$deadline = (Get-Date).AddSeconds(10)
do {
  $windows = @([PackagedWindow]::VisibleWindows($ProcessId))
  if ($windows.Count) { break }
  Start-Sleep -Milliseconds 50
} while ((Get-Date) -lt $deadline)
if ($windows.Count -ne 1) { throw "Expected exactly one visible window for the isolated main process; found $($windows.Count)." }
$handle = $windows[0]
if ($ExpectedHandle -and $handle.ToInt64() -ne $ExpectedHandle) { throw 'The original application window was replaced.' }
if ($Mode -eq 'minimize') { [void][PackagedWindow]::ShowWindowAsync($handle, 6) }
$deadline = (Get-Date).AddSeconds(10)
do {
  $minimized = [PackagedWindow]::IsIconic($handle)
  $foreground = [PackagedWindow]::GetForegroundWindow() -eq $handle
  if (($Mode -eq 'minimize' -and $minimized) -or
      ($Mode -eq 'restored' -and -not $minimized -and $foreground)) { break }
  Start-Sleep -Milliseconds 50
} while ((Get-Date) -lt $deadline)
if ($Mode -eq 'minimize' -and -not $minimized) { throw 'The fixture window was not minimized.' }
if ($Mode -eq 'restored' -and ($minimized -or -not $foreground)) { throw 'The existing window was not restored to the foreground.' }
@{ windowHandle=$handle.ToInt64(); visibleWindows=$windows.Count; minimized=$minimized; foreground=$foreground } | ConvertTo-Json -Compress

param(
  [Parameter(Mandatory=$true)][int]$ProcessId,
  [Parameter(Mandatory=$true)][ValidateSet('en','ar')][string]$Language,
  [Parameter(Mandatory=$true)][string]$Code,
  [Parameter(Mandatory=$true)][string]$OutputPath
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class DialogCapture {
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr window, IntPtr dc, uint flags);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr SendMessageTimeout(IntPtr window, uint message, IntPtr wParam, IntPtr lParam, uint flags, uint timeout, out IntPtr result);
}
'@
$catalog = Get-Content -LiteralPath (Join-Path $PSScriptRoot "../src/locales/$Language.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$expected = $catalog.desktop.$Code
if (-not $expected) { throw 'Unknown expected dialog code.' }
if ($Language -eq 'ar') { $expected = [char]0x202b + $expected + [char]0x202c }
$condition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ProcessIdProperty, $ProcessId)
$deadline = (Get-Date).AddSeconds(25)
$dialogWindow = $null
do {
  $windows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, $condition)
  foreach ($candidate in $windows) {
    $children = $candidate.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
    $names = @($children | ForEach-Object { $_.Current.Name })
    if ($names -contains $expected) { $dialogWindow = $candidate; break }
  }
  if ($dialogWindow) { break }
  if (-not (Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)) { throw 'Application exited before expected dialog.' }
  Start-Sleep -Milliseconds 100
} while ((Get-Date) -lt $deadline)
if (-not $dialogWindow) {
  @($windows | ForEach-Object {
    [pscustomobject]@{ window=$_.Current.Name; children=@($_.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition) | ForEach-Object { $_.Current.Name }) }
  }) | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath ($OutputPath + '-diagnostic.json') -Encoding UTF8
  throw "Expected native dialog not found: $Language/$Code"
}
$messageElement = @($children | Where-Object { $_.Current.Name -eq $expected })[0]
@($children | ForEach-Object {
  [pscustomobject]@{ name=$_.Current.Name; type=$_.Current.ControlType.ProgrammaticName; id=$_.Current.AutomationId;
    top=$_.Current.BoundingRectangle.Top; bottom=$_.Current.BoundingRectangle.Bottom; offscreen=$_.Current.IsOffscreen;
    patterns=@($_.GetSupportedPatterns() | ForEach-Object { $_.ProgrammaticName }) }
}) | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath ($OutputPath + '-controls.json') -Encoding UTF8
# English Windows also exposes a title-bar "Close" control. Select the action
# below the message, not the operating system's title-bar control.
$button = @($children | Where-Object {
  $_.Current.Name -eq $catalog.close -and
  $_.Current.BoundingRectangle.Top -ge $messageElement.Current.BoundingRectangle.Bottom
})
if ($button.Count -ne 1) { throw 'Localized close action below the message missing or ambiguous.' }
$bounds = $dialogWindow.Current.BoundingRectangle
$bitmap = [System.Drawing.Bitmap]::new([int]$bounds.Width, [int]$bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
  $dc = $graphics.GetHdc()
  try {
    if (-not [DialogCapture]::PrintWindow([IntPtr]$dialogWindow.Current.NativeWindowHandle, $dc, 2)) { throw 'Native dialog capture failed.' }
  } finally { $graphics.ReleaseHdc($dc) }
  $bitmap.Save($OutputPath + '.png', [System.Drawing.Imaging.ImageFormat]::Png)
} finally { $graphics.Dispose(); $bitmap.Dispose() }
[pscustomobject]@{ language=$Language; code=$Code; messageMatched=$true; closeButtonMatched=$true; width=$bounds.Width; height=$bounds.Height } |
  ConvertTo-Json | Set-Content -LiteralPath ($OutputPath + '.json') -Encoding UTF8
$invoke = $null
if ($button[0].TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$invoke)) {
  $invoke.Invoke()
} else {
  # This Windows build exposes TaskDialog actions as panes without InvokePattern.
  # Click the exact action found by UIA using the documented TaskDialog message.
  if ($button[0].Current.AutomationId -notmatch '^CommandButton_([0-9]+)$') { throw 'Unknown native action identifier.' }
  $buttonId = [int]$Matches[1]
  $messageResult = [IntPtr]::Zero
  $sent = [DialogCapture]::SendMessageTimeout([IntPtr]$dialogWindow.Current.NativeWindowHandle,
    0x0466, [IntPtr]$buttonId, [IntPtr]::Zero, 2, 2000, [ref]$messageResult)
  if ($sent -eq [IntPtr]::Zero) { throw 'Native action did not respond.' }
}
Write-Output "NATIVE_DIALOG_OK $Language/$Code"

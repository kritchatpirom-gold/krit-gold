$WshShell = New-Object -ComObject WScript.Shell
$StartupFolder = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"
$ShortcutPath = Join-Path $StartupFolder "WranglerDevServer.lnk"
$ScriptPath = "c:\Users\Fischer\krit-gold\scripts\windows\run_wrangler.vbs"

$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = "`"$ScriptPath`""
$Shortcut.WorkingDirectory = "c:\Users\Fischer\krit-gold\scripts\windows"
$Shortcut.WindowStyle = 7 # Minimized
$Shortcut.Save()

Write-Host "Shortcut created in Startup folder: $ShortcutPath"

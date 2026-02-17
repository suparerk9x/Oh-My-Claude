$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\Oh My Claude.lnk")
$Shortcut.TargetPath = "D:\Antigravity\Ake-Workspace\projects\Oh-My-Claude\start.bat"
$Shortcut.WorkingDirectory = "D:\Antigravity\Ake-Workspace\projects\Oh-My-Claude"
$Shortcut.Description = "Start Oh My Claude Dashboard"
$Shortcut.Save()
Write-Host "Shortcut created at: $DesktopPath\Oh My Claude.lnk"

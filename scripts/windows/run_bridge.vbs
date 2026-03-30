Set WshShell = CreateObject("WScript.Shell")
' Run the batch file in hidden mode (0 = Hidden, True = Wait)
WshShell.Run chr(34) & "run_bridge.bat" & chr(34), 0

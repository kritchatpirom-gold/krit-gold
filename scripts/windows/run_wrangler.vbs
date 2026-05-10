Set WshShell = CreateObject("WScript.Shell")
' Get the directory of the current script
strPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
' Run the batch file in hidden mode (0 = Hidden, False = Don't wait for completion)
' We use "cmd /c" to ensure the batch file is executed correctly
WshShell.Run "cmd /c " & chr(34) & strPath & "\run_wrangler.bat" & chr(34), 0, False

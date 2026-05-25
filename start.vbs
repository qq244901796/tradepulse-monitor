Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

root = fso.GetParentFolderName(WScript.ScriptFullName)
bundledNode = root & "\node\node.exe"

If fso.FileExists(bundledNode) Then
  nodeCmd = """" & bundledNode & """"
Else
  nodeCmd = "node"
End If

shell.CurrentDirectory = root
serverCmd = nodeCmd & " ""src\server.js"""
shell.Run serverCmd, 0, False
WScript.Sleep 2000
shell.Run "http://127.0.0.1:14587", 1, False

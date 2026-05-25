param(
    [string]$OutputDir = "dist\tradepulse-monitor",
    [string]$ZipPath = "dist\tradepulse-monitor.zip"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$out = Join-Path $root $OutputDir
$zip = Join-Path $root $ZipPath

if (Test-Path $out) {
    Remove-Item -LiteralPath $out -Recurse -Force
}
New-Item -ItemType Directory -Force $out | Out-Null

Copy-Item -LiteralPath (Join-Path $root "src") -Destination (Join-Path $out "src") -Recurse
Copy-Item -LiteralPath (Join-Path $root "packages") -Destination (Join-Path $out "packages") -Recurse
Copy-Item -LiteralPath (Join-Path $root "public") -Destination (Join-Path $out "public") -Recurse
Copy-Item -LiteralPath (Join-Path $root "config") -Destination (Join-Path $out "config") -Recurse
Copy-Item -LiteralPath (Join-Path $root "package.json") -Destination (Join-Path $out "package.json")
Copy-Item -LiteralPath (Join-Path $root "start.bat") -Destination (Join-Path $out "start.bat")
Copy-Item -LiteralPath (Join-Path $root "start.vbs") -Destination (Join-Path $out "start.vbs")
Copy-Item -LiteralPath (Join-Path $root "README.md") -Destination (Join-Path $out "README.md")

$nodeSource = Join-Path $root "node"
if (Test-Path (Join-Path $nodeSource "node.exe")) {
    Copy-Item -LiteralPath $nodeSource -Destination (Join-Path $out "node") -Recurse
} else {
    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($nodeCommand) {
        $nodeOut = Join-Path $out "node"
        New-Item -ItemType Directory -Force $nodeOut | Out-Null
        Copy-Item -LiteralPath $nodeCommand.Source -Destination (Join-Path $nodeOut "node.exe")
        Write-Output "Bundled Node from: $($nodeCommand.Source)"
    } else {
        Write-Warning "node\node.exe not found and node.exe is not on PATH. The zip will require Node.js installed on the target machine."
    }
}

$appConfig = Join-Path $out "config\app.json"
if (Test-Path $appConfig) {
    Remove-Item -LiteralPath $appConfig -Force
}

if (Test-Path $zip) {
    Remove-Item -LiteralPath $zip -Force
}
Compress-Archive -Path (Join-Path $out "*") -DestinationPath $zip -Force

Write-Output "Package created: $zip"

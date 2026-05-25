param(
    [string]$BundlePath = "packages\core\dist\tradepulse-core.bundle.js",
    [string]$AndroidAssetPath = "android\app\src\main\assets\tradepulse-core.bundle.js"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")

Push-Location $root
try {
    node .\scripts\build-core-bundle.mjs | Out-Host

    $source = Join-Path $root $BundlePath
    $target = Join-Path $root $AndroidAssetPath
    New-Item -ItemType Directory -Force (Split-Path $target -Parent) | Out-Null
    Copy-Item -LiteralPath $source -Destination $target -Force

    Write-Output "Android core synced: $target"
} finally {
    Pop-Location
}

$chrome = "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
$profile = "D:\tradepulse\.chrome-profile"
$url = "https://app-trps.tradepulse.net/export"

if (-not (Test-Path $chrome)) {
    throw "Chrome not found: $chrome"
}

Start-Process -FilePath $chrome -ArgumentList @(
    "--remote-debugging-port=9224",
    "--remote-allow-origins=*",
    "--user-data-dir=$profile",
    "--profile-directory=Default",
    $url
)

Write-Output "Started Chrome for TradePulse automation on http://127.0.0.1:9224"

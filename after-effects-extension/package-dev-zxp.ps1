$ErrorActionPreference = "Stop"

$extensionRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $extensionRoot
$distDir = Join-Path $repoRoot "dist"
$output = Join-Path $distDir "EffectsAcademy-AE-Panel-dev.zxp"
$tempZip = Join-Path $distDir "EffectsAcademy-AE-Panel-dev.zip"

New-Item -ItemType Directory -Force -Path $distDir | Out-Null
Compress-Archive -Path (Join-Path $extensionRoot "*") -DestinationPath $tempZip -Force
Move-Item -LiteralPath $tempZip -Destination $output -Force

Write-Host "Created $output"

$ErrorActionPreference = "Stop"

$extensionRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $extensionRoot
$distDir = Join-Path $repoRoot "dist"
$output = Join-Path $distDir "EffectsAcademy-AE-Panel-dev.zxp"

New-Item -ItemType Directory -Force -Path $distDir | Out-Null
Compress-Archive -Path (Join-Path $extensionRoot "*") -DestinationPath $output -Force

Write-Host "Created $output"

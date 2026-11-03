#Requires -Version 5.1

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$AppName = '桌面闹钟'
# 版本号以 src-tauri/tauri.conf.json 为唯一来源，避免硬编码漏更
$ConfText = Get-Content -Raw 'src-tauri/tauri.conf.json'
$AppVersion = [regex]::Match($ConfText, '"version"\s*:\s*"([^"]+)"').Groups[1].Value
$BundleDir = 'src-tauri/target/release/bundle/nsis'
$ReleaseDir = 'release'

Write-Host "🪟 构建 ${AppName} v${AppVersion}"
Write-Host "=============================="

if (-not (Test-Path 'package.json')) {
    Write-Host '❌ 请在项目根目录运行此脚本'
    exit 1
}

foreach ($tool in @('node', 'npm', 'rustc', 'cargo')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Host "❌ 未检测到 ${tool}，请先安装 Node.js 和 Rust（https://rustup.rs）"
        exit 1
    }
}

Write-Host "✅ Node: $(node --version)"
Write-Host "✅ Rust: $(rustc --version)"

Write-Host ''
Write-Host '🧹 清理旧产物...'
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue 'dist', 'src-tauri/target', $ReleaseDir

Write-Host ''
Write-Host '📦 安装依赖...'
npm install
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ''
Write-Host '🔨 构建桌面应用（NSIS 安装包）...'
npm run tauri:build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$installer = Get-ChildItem -Path $BundleDir -Filter '*.exe' | Select-Object -First 1
if (-not $installer) {
    Write-Host "❌ 未找到构建产物: ${BundleDir}"
    exit 1
}

New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null
$releasePath = Join-Path $ReleaseDir $installer.Name
Copy-Item $installer.FullName $releasePath

Write-Host ''
Write-Host '✅ 构建完成'
Write-Host "Installer: ${releasePath}"

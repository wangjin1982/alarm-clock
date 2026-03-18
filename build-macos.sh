#!/bin/bash

set -euo pipefail

APP_NAME="桌面闹钟"
APP_VERSION="1.0.0"
APP_PATH="src-tauri/target/release/bundle/macos/${APP_NAME}.app"
RELEASE_DIR="release"
DMG_PATH="${RELEASE_DIR}/${APP_NAME}_${APP_VERSION}_arm64.dmg"

export CC=/usr/bin/cc
export CXX=/usr/bin/c++

echo "🍎 构建 ${APP_NAME}"
echo "=============================="

if [ ! -f "package.json" ]; then
  echo "❌ 请在项目根目录运行此脚本"
  exit 1
fi

if ! command -v rustc >/dev/null 2>&1; then
  echo "❌ 未检测到 Rust，请先安装 Rust"
  exit 1
fi

echo "✅ Rust: $(rustc --version)"
echo "✅ Cargo: $(cargo --version)"
echo "✅ 编译器: ${CC}"

echo ""
echo "🧹 清理旧产物..."
rm -rf dist src-tauri/target "${RELEASE_DIR}"

echo ""
echo "📦 安装依赖..."
npm install

echo ""
echo "🔨 构建桌面应用..."
npm run tauri:build

if [ ! -d "${APP_PATH}" ]; then
  echo "❌ 未找到构建产物: ${APP_PATH}"
  exit 1
fi

echo ""
echo "🔏 修复并验证签名..."
xattr -cr "${APP_PATH}" 2>/dev/null || true
codesign --force --deep --sign - "${APP_PATH}"
codesign --verify --deep --strict "${APP_PATH}"

mkdir -p "${RELEASE_DIR}"
cp -R "${APP_PATH}" "${RELEASE_DIR}/"

echo ""
echo "💿 生成简洁 DMG..."
TMP_DIR="$(mktemp -d)"
mkdir -p "${TMP_DIR}"
cp -R "${RELEASE_DIR}/${APP_NAME}.app" "${TMP_DIR}/"
ln -s /Applications "${TMP_DIR}/Applications"
if hdiutil create \
  -volname "${APP_NAME}" \
  -srcfolder "${TMP_DIR}" \
  -fs HFS+ \
  -format UDZO \
  -ov \
  "${DMG_PATH}" >/dev/null; then
  DMG_RESULT="${DMG_PATH}"
else
  echo "⚠️ DMG 生成失败，已保留签名完成的 .app"
  DMG_RESULT="未生成"
fi
rm -rf "${TMP_DIR}"

echo ""
echo "✅ 构建完成"
echo "App: ${RELEASE_DIR}/${APP_NAME}.app"
echo "DMG: ${DMG_RESULT}"

# 桌面闹钟

一个面向 macOS 的桌面闹钟小工具，主打轻量常驻、桌面悬浮和自然语音提醒。项目使用 `React + TypeScript + Vite` 构建界面，外层通过 `Tauri 2` 封装为桌面应用。

当前稳定版本：`v2.0.0`

## 当前能力

- 番茄钟
- 番茄完成次数按天记录
- 每轮专注显示一条励志金句
- 专注结束自动进入休息
- 休息结束自动切回下一轮专注待机
- 独立闹钟列表与提醒
- 支持窗口置顶、拖动、最小化和关闭

## 技术栈

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Tauri 2
- Rust

## 本地开发

安装依赖：

```bash
npm install
```

启动前端开发环境：

```bash
npm run dev
```

启动桌面开发模式：

```bash
npm run tauri:dev
```

## 构建应用

推荐直接使用仓库自带脚本：

```bash
./build-macos.sh
```

这个脚本会自动完成：

- 清理旧构建产物
- 使用系统编译器构建 Tauri App
- 修复并验证 macOS 本地签名
- 生成可分发的 `.app`
- 尝试生成 `.dmg`

构建完成后的产物位于 `release/`：

```text
release/
├── 桌面闹钟.app
└── 桌面闹钟_2.0.0_arm64.dmg
```

如果当前环境的 `hdiutil` 失败，脚本会保留已签名完成的 `.app`。

## Windows 便携版

仓库已经提供 GitHub Actions 工作流来构建 Windows 免安装运行版：

- 工作流文件：`.github/workflows/windows-portable.yml`
- 产物格式：`桌面闹钟_<版本号>_windows_portable.zip`
- 包内包含：可直接运行的 `桌面闹钟.exe`

说明：

- 这个便携版会在 GitHub Actions 的 Windows 环境中生成，不依赖当前这台 mac 本机交叉编译。
- Windows 机器首次运行时通常仍需要系统已安装 WebView2 Runtime。

## 权限与发布说明

- 当前仓库默认产出的应用是本地签名版本，不包含 Apple notarization 公证。
- 未公证的 `.app` 第一次从 Finder 打开时，macOS 可能提示无法验证开发者。可以通过“右键应用 -> 打开”或在“系统设置 -> 隐私与安全性”中放行。

## 项目结构

```text
alarm-clock/
├── src/                    # React 前端界面与业务逻辑
├── src-tauri/              # Tauri / Rust 桌面端实现
├── public/                 # 静态资源
├── build-macos.sh          # macOS 构建脚本
├── package.json            # 前端依赖与脚本
└── README.md
```

## 备注

- 充电提醒相关功能已经移除，不再加载。
- 桌面提醒由 Rust 后台定时触发，应用不在前台时也能播报。
- 天气与定位相关代码仍保留在仓库中，但当前主界面默认隐藏。

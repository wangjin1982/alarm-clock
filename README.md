# 桌面闹钟

一个跨平台（macOS / Windows）的桌面闹钟小工具，主打轻量常驻、桌面悬浮和自然语音提醒。项目使用 `React + TypeScript + Vite` 构建界面，外层通过 `Tauri 2` 封装为桌面应用。

当前稳定版本：`v2.2.0`

## 当前能力

- 数字时钟（固定展示，含日期与星期）
- 番茄钟
- 6 款皮肤（深空/森林/深海/暮色/晨雾/蔚蓝，设置中切换，即时生效并记住选择）
- 自定义倒计时（按目标时间或时长设定，适合"距离下课/会议还有多久"场景）
- 自动定位显示实时天气（系统定位 → IP 定位 → 手动城市，三级降级，支持语音播报）
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

### Windows

直接在项目根目录运行 PowerShell 脚本（如遇"禁止运行脚本"策略限制，加 `-ExecutionPolicy Bypass` 参数即可）：

```powershell
powershell -ExecutionPolicy Bypass -File .\build-windows.ps1
```

这个脚本会自动完成：

- 清理旧构建产物
- 安装 npm 依赖
- 构建前端并编译 Tauri 应用（自动使用 `src-tauri/tauri.windows.conf.json`，产出 NSIS 安装包）

构建完成后的产物位于 `release/`：

```text
release/
└── 桌面闹钟_2.2.0_x64-setup.exe
```

Windows 依赖说明：

- 需要本机已安装 Node.js、Rust（https://rustup.rs）和 Microsoft C++ 构建工具（Visual Studio Build Tools 的"使用 C++ 的桌面开发"工作负载）。
- 运行应用需要系统已安装 WebView2 Runtime（Windows 11 自带，Windows 10 多数也已预装）。

### macOS

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

> 平台差异说明：安装包目标按平台拆分在 `src-tauri/tauri.macos.conf.json`（`.app`）和 `src-tauri/tauri.windows.conf.json`（NSIS）中，公共配置仍在 `src-tauri/tauri.conf.json`。

## Windows 便携版

仓库还提供 GitHub Actions 工作流来构建 Windows 免安装运行版：

- 工作流文件：`.github/workflows/windows-portable.yml`
- 产物格式：`桌面闹钟_<版本号>_windows_portable.zip`
- 包内包含：可直接运行的 `桌面闹钟.exe`

说明：

- 便携版适合不想安装的场景；需要完整安装体验时请使用上面的 `build-windows.ps1` 在本机构建。
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
├── build-windows.ps1       # Windows 构建脚本
├── package.json            # 前端依赖与脚本
└── README.md
```

## 备注

- 充电提醒相关功能已经移除，不再加载。
- 桌面提醒由 Rust 后台定时触发，应用不在前台时也能播报。
- 天气卡片默认开启，自动通过系统定位获取位置（macOS 用 CoreLocation，Windows 用系统定位服务）；未授权时降级为 IP 定位。

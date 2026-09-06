# 复盘：Tauri 无边框窗口「锁定」bug（2026-09-06，已修复并实测通过）

> 现象：桌面闹钟 v2.1.0 启动后窗口无法移动、关闭、最小化，界面看似「被锁定」。
> 根因：`tauri.conf.json` 的 capability 缺 `windows` 字段，权限配置静默失效。

## 一、值得表扬的地方（经验沉淀）

1. **先核实「运行的到底是什么」，再谈修复**
   用户报告 bug 时，先用 `ps` + `stat` 对齐三条时间线：配置修改时间(22:10) → 构建时间(22:11) → 进程启动时间(22:13)。发现跑着的确实是「修复后」的构建，才避免重复走「加权限→重打包」的老路。
2. **分层隔离故障域，比猜测快**
   用 cliclick + screencapture 实测：点「番茄钟」手风琴能展开(纯 React 状态) → 点设置齿轮能开弹窗(纯 React) → 但关闭/最小化/拖动(Tauri IPC)全失败。三步点击把故障域从「整个窗口不响应」收窄到「只有走 Tauri IPC 的操作失败」，直接指向权限层。
3. **读框架源码确认行为，不凭记忆**
   直接翻 `~/.cargo/registry/src/tauri-utils-2.8.3/src/acl/capability.rs`，看到 `#[serde(default)] pub windows: Vec<String>` —— 缺失即空数组，空数组即不作用于任何窗口。一锤定音，没有靠「我记得应该是……」。
4. **修复后用合成鼠标事件做行为级验收**
   拖动(窗口坐标 545,131 → 635,176)、最小化(AXMinimized=true)、关闭(进程退出)三项全部实测通过才交付，而不是「构建成功 = 修好了」。

## 二、值得改进的地方（踩过的坑）

1. **capability 缺 `windows` 字段 → 权限静默失效**
   - 现象：权限列表写了 `allow-start-dragging` / `allow-minimize` / `allow-destroy` 等 7 条，构建也成功，但全部不生效。
   - 根因：Tauri v2 的 capability 必须用 `windows: ["*"]` 声明作用窗口；缺失时 serde default 为空数组 → 不匹配任何窗口 → 所有窗口 IPC 被拒绝。配置合法、构建无警告、运行无弹窗，只在点击时静默失败。
   - 代价：至少两轮完整构建 + 安装 + 用户侧一次「修了但没修好」的挫败体验。
   - 防复发：无边框窗口配置 checklist（见第四象限），其中 `windows: ["*"]` 是必检项。
2. **用 `strings 二进制 | grep 权限名` 验证修复 —— 假阳性**
   - 现象：旧二进制里也能 grep 到 `allow-start-dragging`(出现 2 次)，一度误判「权限已打进去了」。
   - 根因：Tauri 把全部已知权限的 schema 嵌进二进制用于校验，字符串存在 ≠ capability 生效。
   - 防复发：验证修复只信**行为证据**（实际操作成功），不信**制品痕迹**(grep/strings/时间戳)。
3. **自动化测试的观察者效应**
   - 现象①：screencapture 触发 macOS「屏幕录制权限」系统弹窗，恰好盖住窗口，下一次点击打在弹窗上，险些误判为「点击失效」。
   - 现象②：第一次最小化测试返回 false —— 实际是 app 刚启动未激活，焦点没进去。
   - 防复发：UI 自动化断言前先处理系统弹窗、`open -a` 激活目标 app、操作间留 sleep;失败时先怀疑测试方法，再怀疑被测对象。
4. **（存疑项）`transparent: true` + 无边框**
   本轮修复顺带把 `transparent` 改为 `false`。未单独隔离验证它是否参与致病，记录为待证实的嫌疑，不当下结论。

## 三、有意思的 Concept

1. **静默空集（Silent Empty Scope）**
   「配置了权限」和「权限作用于谁」是两件事。凡是带作用域字段的配置（windows/scopes/targets），缺失时往往默认空集而非全集，且空集不报错。本项目证据：7 条权限配置齐全，唯独缺 `windows`，效果等于零配置。
2. **真相分层：文件 < 制品 < 行为**
   配置文件写了 ≠ 二进制里有 ≠ 运行时生效。每一层都可能说谎：文件可能没进构建，制品里的字符串可能只是 schema，只有行为测试是终审。本项目三层各踩了一次。
3. **无 chrome 应用 = 自己重新发明窗口管理**
   一旦 `decorations: false`，移动/关闭/最小化全都从「操作系统白送」变成「自己的代码 + 权限配置」，任何一个环节（事件、IPC、ACL、作用域）断了，用户看到的就是「界面锁死」。砍掉 chrome 的成本不是零，是转移。

## 四、值得创建的工作流 / 技能包

**候选：`tauri-frameless-window-check`（建议立即执行）**
- 触发场景：Tauri 项目使用 `decorations: false` / 透明窗口，或用户报告「窗口拖不动/关不掉/按钮没反应」。
- 核心内容（均来自本次实战）:
  1. capability 必含 `windows: ["*"]`（或具体窗口 label) —— 第一检查项；
  2. 权限清单：`core:window:allow-start-dragging` / `allow-close` 或 `allow-destroy` / `allow-minimize`(+ 按需 `allow-set-always-on-top` 等）;
  3. 拖拽首选 `data-tauri-drag-region` 属性（原生、同步）,JS 异步调 `startDragging()` 作为兜底；
  4. 验收用行为测试：cliclick 拖动看坐标变化、点关闭看进程退出，禁止用 strings/grep 二进制当证据；
  5. 自动化前先处理系统权限弹窗并激活 app。
- 素材来源：本次会话完整排障链 + `tauri-utils-2.8.3/acl/capability.rs` 源码证据。
- 判断：Tauri 无边框窗口是常见需求，此坑出现频率中 × 单次代价高（两轮全量构建+用户挫败）,**值得沉淀**。

---

*备注：按惯例本文档应 git commit 入库，但遵循「不主动执行 git 变更」约定，是否提交由你决定。*

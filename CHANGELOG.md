# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-08-01

### Fixed

- **macOS 底部输入框被裁切**：`main.rs` 中 webview 不再硬编码 1400×900，改用 `window.inner_size()` 实际尺寸创建；并添加 `on_window_event(Resized)` 监听器，窗口缩放时显式同步 webview 尺寸（macOS WKWebView 的 `auto_resize` 在 Tauri 中不可靠）
- **macOS 卡片头部按钮被 webview 遮挡**：`webview-manager.js` 改用 `cell-body` 边界测量 webview 起始位置，顶部留 32px 缓冲吸收 WKWebView 层-backed 渲染溢出；底部略微溢出 2px 确保无空白
- **macOS webview 切换后内容不可见**：`commands.rs` 调整生命周期顺序，先 `set_position`/`set_size` 再 `show`，移除导致内容消失的 `set_focus()` 调用
- **通义千问文本重复插入**：`main.js` 中 `beforeinput` 事件被 Slate.js 拦截后仍执行 `execCommand('insertText')` 导致二次插入。改为检查 `bi.defaultPrevented`，Slate 已接管时跳过 `execCommand`；移除多余的 `input` 事件派发

### Changed

- **webview 布局测量**：从依赖 `cell-body` 顶部改为同时使用 `cell-body` 的 `top`/`bottom` 边界，消除 flex 布局亚像素偏差
- **cell-body 样式**：加 `#f8f9fa` 背景色与 `border-top` 分隔线，移除 `padding-top`

## [1.0.0] - 2026-07-31

### Added

- **Tauri 2.x 技术架构重构**：从 Electron 迁移至 Tauri，打包体积从 100-150MB 降至 3-10MB
- **单窗口多 WebView 架构**：通过 `window.add_child(WebViewBuilder)` 在主窗口内叠加多个子 WebView，替代 Electron 的 `<webview>` 标签方案
- **自定义 URI 协议通信**：实现 `aiinone://` 协议用于子 WebView 向主窗口回传登录状态
- **UA 劫持机制**：支持 `uaOverride` 字段，通过 `Object.defineProperty` 劫持 `navigator.userAgent`
- **项目文档**：`README.md` 包含技术栈、项目结构、架构说明、常见问题排查

### Changed

- **前端技术栈**：从 Electron + HTML 迁移至原生 JS + Vite 5 + Tauri API
- **文本注入方式**：从 Electron `insertText` 原生 API 改为纯 JS 模拟（`document.execCommand('insertText')` + 事件派发）
- **WebView 管理**：新增 `webview-manager.js` 封装 child WebView 的创建、布局、JS 执行、刷新等操作
- **站点配置结构**：重构 `sites.js`，新增 `needsBeforeInput`、`uaOverride` 等可选字段

### Fixed

- **Kimi 输入文本重复三次**：移除手动派发的 `input` 事件（`execCommand` 内部已自动触发），避免 React 受控组件重复处理
- **Kimi 输入文本重复两次**：将 `input` 事件派发改为按需（`needsBeforeInput`）执行，普通 contenteditable 站点仅依赖 `execCommand` 内部事件
- **腾讯元宝版本过低提示**：通过注入 UA 劫持代码，在 `navigator.userAgent` 中添加 `app/tencent_yuanbao` 标识，绕过站点浏览器检测白名单
- **通义千问输入框无法定位**：`inputSelector` 从 `div[contenteditable="true"][role="textbox"]` 改为 `div[contenteditable="true"][data-slate-editor="true"]`，精确匹配 Slate.js 编辑器根节点
- **通义千问文本无法填入**：适配 Slate.js 编辑器事件机制，先派发 `beforeinput` 事件触发 Slate 状态更新，再执行 `execCommand('insertText')` 写入 DOM
- **Vite 与 Cargo 文件监视冲突**：在 `vite.config.js` 中排除 `src-tauri/target/**` 目录，解决 `EBUSY` 错误
- **Tauri 2.x API 兼容性**：修复 `register_uri_scheme_protocol` 签名变更、`emit` 调用方式
- **图标生成**：使用 Tauri CLI `tauri icon` 工具生成标准多尺寸 ICO 文件，修复 `RC2175` 格式错误

### Removed

- Electron 相关依赖与配置文件
- 废弃的 `Shell::open` 接口，改用 `opener::open` crate

### Dependencies

- Added: `tauri` (with `unstable` feature), `tauri-plugin-shell`, `serde`, `serde_json`, `url`, `opener`
- Added: `@tauri-apps/api`, `@tauri-apps/plugin-shell`, `vite`, `@tauri-apps/cli`
- Removed: Electron, `electron-builder`, 相关 ESLint/Prettier 等开发依赖
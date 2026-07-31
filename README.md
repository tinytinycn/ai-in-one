# AI IN ONE

基于 Tauri 2.x 的多 AI 助手聚合桌面应用。一次输入，同步发送给多个 AI 模型。

## 特性

- 聚合 9 个主流 AI 平台（DeepSeek、通义千问、Kimi、豆包、文心一言等）
- 支持 1-4 个模型同时使用，多种布局切换
- 登录态持久化（WebView2 User Data Folder）
- 打包体积小（约 3-10MB），使用系统 WebView2

## 技术栈

- **前端**：原生 JS + Vite 5
- **后端**：Rust + Tauri 2.x
- **构建**：Tauri CLI

## 项目结构

```
ai-all-in-one/
├── index.html                    # 前端入口
├── package.json                  # 前端依赖与脚本
├── vite.config.js                # Vite 配置
├── icon.png                      # 应用图标源文件
├── src/
│   ├── main.js                   # 前端主逻辑（模型选择、布局、发送）
│   ├── sites.js                  # AI 站点配置（9 个站点）
│   ├── webview-manager.js        # WebView 生命周期管理
│   └── styles.css                # 样式
└── src-tauri/
    ├── Cargo.toml                # Rust 依赖
    ├── tauri.conf.json           # Tauri 应用配置
    ├── build.rs                  # Tauri 构建脚本
    ├── capabilities/
    │   └── default.json          # 权限配置
    ├── icons/                    # 应用图标（多平台格式）
    ├── gen/                      # Tauri 自动生成
    └── src/
        ├── main.rs               # Tauri 主入口
        └── commands.rs           # Invoke 命令（WebView 操作）
```

## 环境要求

- **Node.js** >= 18
- **Rust** >= 1.70（通过 rustup 安装）
- **Tauri 系统依赖**（Windows 已默认安装）：
  - Microsoft Visual C++ Build Tools
  - WebView2（Win10/11 已内置）

## 快速开始

### 安装依赖

```bash
# 安装前端依赖
npm install

# Rust 依赖会在首次编译时自动下载
```

### 开发模式

```bash
# 仅启动前端（Vite dev server）
npm run dev

# 启动完整 Tauri 应用（前端 + Rust 后端）
npm run tauri:dev
```

### 构建

```bash
# 仅构建前端
npm run build

# 构建完整应用（生成安装包）
npm run tauri:build
```

构建产物位于 `src-tauri/target/release/bundle/`：
- Windows: `.msi` 或 `.exe` 安装包

## 配置 AI 站点

站点配置位于 [`src/sites.js`](src/sites.js)，每个站点包含：

```js
{
  name: "站点名称",
  label: "唯一标识",
  url: "https://...",
  inputSelector: "输入框 CSS 选择器",
  buttonSelector: "发送按钮 CSS 选择器",
  submitType: "click" | "enter",
  messageSelector: "回复区域选择器（可选）"
}
```

## 核心架构

### 窗口/WebView 层级

```
主窗口 (含标题栏)
├── 主 WebView（加载前端控制面板）
│   ├── 模型复选框行
│   ├── 布局切换按钮
│   ├── 输入框 + 发送按钮
│   └── 网格占位区（透明叠加层）
├── child WebView 1 (DeepSeek)
├── child WebView 2 (通义千问)
└── ...
```

### 通信流程

```
前端 ──invoke──▶ Rust 命令 ──add_child/eval──▶ child WebView
    ▲                                              │
    └────────── emit 事件 ──── Rust ──────────────┘
```

- **前端 → Rust**：通过 `invoke` 调用 `create_webview`、`layout_webviews`、`eval_in_webview`、`reload_webview`、`open_in_browser`、`get_webview_url`
- **状态回传**：通过自定义 URI scheme (`aiinone://`) 拦截并 `emit` 事件给前端

### 登录持久化

使用 WebView2 的 `data_directory` 特性，每个 child WebView 共享同一个 User Data Folder，天然隔离各站点 Cookie。

## 常见问题

### 端口冲突

Vite 默认使用 1420 端口（Tauri 约定）。如需修改，同时更新 `vite.config.js` 和 `src-tauri/tauri.conf.json` 中的 `devUrl`。

### Rust 依赖下载慢

配置 Cargo 国内镜像源（`~/.cargo/config.toml`）：

```toml
[source.crates-io]
replace-with = 'mirrors'

[source.mirrors]
registry = "sparse+https://mirrors.aliyun.com/crates.io-index/"
```

### WebView2 未安装

Win10/11 已内置。若在旧系统运行，需安装 [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)。

## 与原 Electron 版本对比

| 指标 | Electron | Tauri |
|------|----------|-------|
| 打包体积 | 100-150MB | 3-10MB |
| 内存占用 | 较高 | 较低 |
| 依赖 | Chromium 捆绑 | 系统 WebView2 |
| 启动速度 | 较慢 | 较快 |

## 致谢

本项目基于 [Hart-Li/ai-in-one](https://github.com/Hart-Li/ai-in-one) 项目重构，感谢原作者的贡献。

原项目采用 Electron 架构实现了多 AI 助手聚合功能，本项目在其基础上使用 Tauri 2.x 技术栈进行重构，保留了核心的站点配置与交互逻辑。

## License

Apache License 2.0

本项目继承原项目的 [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) 开源协议。
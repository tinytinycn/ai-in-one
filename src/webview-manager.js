// WebView 生命周期管理: 通过 Tauri invoke 控制 child webviews
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

// 兼容性最好的 Windows Chrome UA
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// 已创建的 webview label 集合 (避免重复创建)
const createdWebviews = new Set();

/**
 * 创建一个 child webview (若已存在则跳过)
 * @param {object} site - sites.js 中的站点配置
 */
export async function createWebview(site) {
  if (createdWebviews.has(site.label)) return;
  createdWebviews.add(site.label);
  const initScript = buildStatusScript(site.label, site.inputSelector, site.uaOverride);
  try {
    await invoke("create_webview", {
      args: {
        label: site.label,
        url: site.url,
        x: 0,
        y: 0,
        w: 100,
        h: 100,
        userAgent: UA,
        initScript,
      },
    });
    // 创建后立即隐藏, 飞入动画期间不显示; 由 layoutWebviews 在动画结束后显示
    await invoke("layout_webviews", {
      cells: [{ label: site.label, x: 0, y: 0, w: 0, h: 0, visible: false }],
    });
  } catch (e) {
    console.error(`[createWebview] ${site.label} failed:`, e);
    createdWebviews.delete(site.label);
  }
}

/**
 * 测量当前 DOM 中各 cell-body 的位置, 重新定位所有 child webviews
 * @param {string[]} activeLabels - 当前激活的 webview label 列表
 */
export async function layoutWebviews(activeLabels) {
  const gridRegion = document.getElementById("grid-region");
  if (!gridRegion) return;
  const activeSet = new Set(activeLabels);
  const cells = [];

  // 激活的 cell: 测量 cell-body 坐标
  gridRegion.querySelectorAll(".cell").forEach((cell) => {
    const body = cell.querySelector(".cell-body");
    if (!body) return;
    const rect = body.getBoundingClientRect();
    // 飞入/飞出中的卡片: webview 保持隐藏 (transform 会干扰测量, 且动画期间不应显示)
    const hidden =
      cell.classList.contains("card-fly-in") ||
      cell.classList.contains("card-fly-out");
    cells.push({
      label: cell.dataset.label,
      x: rect.left,
      y: rect.top,
      w: rect.width,
      h: rect.height,
      visible: !hidden,
    });
  });

  // 未激活但已创建的 webview: 隐藏
  createdWebviews.forEach((label) => {
    if (!activeSet.has(label)) {
      cells.push({ label, x: 0, y: 0, w: 0, h: 0, visible: false });
    }
  });

  if (cells.length === 0) return;
  try {
    await invoke("layout_webviews", { cells });
  } catch (e) {
    console.error("[layoutWebviews] failed:", e);
  }
}

/**
 * 隐藏单个 child webview (取消勾选飞出时调用, 避免原生窗口孤儿停留)
 */
export async function hideWebview(label) {
  try {
    await invoke("layout_webviews", {
      cells: [{ label, x: 0, y: 0, w: 0, h: 0, visible: false }],
    });
  } catch (e) {
    console.error(`[hideWebview] ${label} failed:`, e);
  }
}

/** 在指定 webview 中执行 JS */
export async function evalInWebview(label, script) {
  try {
    await invoke("eval_in_webview", { label, script });
  } catch (e) {
    console.error(`[evalInWebview] ${label} failed:`, e);
  }
}

/** 刷新指定 webview (重新加载当前页) */
export async function reloadWebview(label) {
  try {
    await invoke("reload_webview", { label });
  } catch (e) {
    console.error(`[reloadWebview] ${label} failed:`, e);
  }
}

/** 获取指定 webview 当前 URL */
export async function getWebviewUrl(label) {
  try {
    return await invoke("get_webview_url", { label });
  } catch (e) {
    console.error(`[getWebviewUrl] ${label} failed:`, e);
    return null;
  }
}

/** 在系统默认浏览器中打开 URL */
export async function openInBrowser(url) {
  try {
    await invoke("open_in_browser", { url });
  } catch (e) {
    console.error("[openInBrowser] failed:", e);
  }
}

/** 监听登录状态事件 (child webview → Rust → 前端) */
export function onLoginStatus(callback) {
  return listen("login-status", (e) => callback(e.payload));
}

/**
 * 构造登录状态轮询脚本, 注入 child webview 的 initialization_script
 * 通过自定义 URI scheme (aiinone:// → http://aiinone.localhost) 回传状态
 * @param {string} label - webview 标识
 * @param {string} selector - 输入框 CSS 选择器
 * @param {string} [uaOverride] - 可选, 追加到 navigator.userAgent 的字符串 (用于绕过站点浏览器检测)
 */
function buildStatusScript(label, selector, uaOverride) {
  const labelJson = JSON.stringify(label);
  const selectorJson = JSON.stringify(selector);
  const uaOverrideJson = JSON.stringify(uaOverride || "");
  return `(function(){
    if (${uaOverrideJson}) {
      try {
        var _origUA = navigator.userAgent;
        Object.defineProperty(navigator, 'userAgent', {
          get: function() { return _origUA + ' ' + ${uaOverrideJson}; },
          configurable: true
        });
      } catch(e) {}
    }
    setInterval(function(){
      try {
        var r = !!document.querySelector(${selectorJson});
        fetch('http://aiinone.localhost/status?label=' + encodeURIComponent(${labelJson}) + '&ready=' + r, {mode:'no-cors'}).catch(function(){});
      } catch(e) {}
    }, 2000);
  })();`;
}

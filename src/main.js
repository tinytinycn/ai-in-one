// AI IN ONE - 前端主逻辑 (从原 Electron renderer.js 迁移至 Tauri)
import sites from "./sites.js";
import {
  createWebview,
  layoutWebviews,
  evalInWebview,
  reloadWebview,
  getWebviewUrl,
  openInBrowser,
  onLoginStatus,
  hideWebview,
} from "./webview-manager.js";

const grid = document.getElementById("grid-region");
const mainInput = document.getElementById("main-input");
const sendBtn = document.getElementById("send-btn");
const modelSelector = document.getElementById("model-selector");
const layoutToggle = document.getElementById("layout-toggle");
const layoutBtn = document.getElementById("layout-btn");

// 状态管理
const MAX_SELECTED = 4;
let activeModels = [];
let layoutMode = "grid"; // 'grid' = 四宫格, 'row' = 平铺
let prevActiveModels = []; // 上次激活的模型, 用于计算 added/removed 驱动飞入/飞出

// 默认选中 DeepSeek 与通义千问
const defaultNames = ["DeepSeek", "通义千问 (Qwen)"];
activeModels = [...defaultNames];

// ===== 初始化复选框 =====
sites.forEach((site) => {
  const label = document.createElement("label");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.value = site.name;
  checkbox.checked = defaultNames.includes(site.name);
  checkbox.addEventListener("change", (e) => {
    handleCheckboxChange(site.name, e.target.checked, e.target);
  });
  label.appendChild(checkbox);
  label.appendChild(document.createTextNode(site.name));
  modelSelector.appendChild(label);
});

// ===== 创建/获取 cell (仅 header + 空 body, webview 由 Tauri 叠加) =====
function createCell(site) {
  const cell = document.createElement("div");
  cell.className = "cell";
  cell.dataset.label = site.label;

  const header = document.createElement("div");
  header.className = "cell-header";
  header.innerHTML = `
    <div class="header-left" style="display:flex; align-items:center; gap:5px;">
      <span>${site.name}</span>
    </div>
    <div class="header-controls">
      <span class="login-tip" style="font-size:10px; color:#d9534f; display:none;">需要登录?</span>
      <div class="status-indicator" title="灰色:加载中/未登录; 绿色:就绪"></div>
      <button class="icon-btn open-browser-btn" title="在默认浏览器中打开">🌐</button>
      <button class="icon-btn maximize-btn" title="最大化/还原">⤢</button>
      <button class="icon-btn reload-btn" title="刷新页面">↻</button>
    </div>
  `;

  const body = document.createElement("div");
  body.className = "cell-body";

  // 在默认浏览器中打开
  header.querySelector(".open-browser-btn").onclick = async () => {
    const url = await getWebviewUrl(site.label);
    openInBrowser(url && url !== "about:blank" ? url : site.url);
  };

  // 刷新
  header.querySelector(".reload-btn").onclick = () => {
    reloadWebview(site.label);
  };

  // 最大化/还原
  header.querySelector(".maximize-btn").onclick = () => {
    const isMaximized = cell.classList.toggle("maximized");
    const btn = header.querySelector(".maximize-btn");
    if (isMaximized) {
      grid.classList.add("has-maximized");
      btn.textContent = "↙";
      btn.title = "还原";
    } else {
      grid.classList.remove("has-maximized");
      btn.textContent = "⤢";
      btn.title = "最大化";
    }
    relayout();
  };

  cell.appendChild(header);
  cell.appendChild(body);
  return cell;
}

// ===== 复选框逻辑 =====
function handleCheckboxChange(siteName, isChecked, checkboxEl) {
  if (isChecked) {
    if (activeModels.length >= MAX_SELECTED) {
      checkboxEl.checked = false;
      alert(`最多只能选择 ${MAX_SELECTED} 个模型`);
      return;
    }
    if (!activeModels.includes(siteName)) {
      activeModels.push(siteName);
    }
  } else {
    if (activeModels.length <= 1 && activeModels.includes(siteName)) {
      checkboxEl.checked = true;
      alert("至少需要保留一个模型");
      return;
    }
    activeModels = activeModels.filter((n) => n !== siteName);
  }
  updateLayout();
}

// ===== 布局更新 (diff: added 飞入 / removed 飞出 / kept 重排) =====
async function updateLayout() {
  const count = activeModels.length;
  const added = activeModels.filter((n) => !prevActiveModels.includes(n));
  const removed = prevActiveModels.filter((n) => !activeModels.includes(n));
  prevActiveModels = [...activeModels];

  // === 移除的卡片: 脱离文档流固定在原位 + 飞出动画 ===
  removed.forEach((name) => {
    const site = sites.find((s) => s.name === name);
    if (!site) return;
    const cell = grid.querySelector(`.cell[data-label="${site.label}"]`);
    if (!cell) return;
    // 脱离流并固定在原位, 让剩余卡片立即重排
    cell.style.left = `${cell.offsetLeft}px`;
    cell.style.top = `${cell.offsetTop}px`;
    cell.style.width = `${cell.offsetWidth}px`;
    cell.style.height = `${cell.offsetHeight}px`;
    cell.style.position = "absolute";
    cell.style.zIndex = "5";
    // 立即隐藏其 webview (原生窗口不会跟随 CSS transform)
    hideWebview(site.label);
    // 触发飞出, 动画结束移除节点
    cell.classList.add("card-fly-out");
    cell.addEventListener("animationend", () => cell.remove(), { once: true });
  });

  // === 更新 grid 模式类 (剩余卡片立即重排到新布局) ===
  grid.classList.remove("mode-1", "mode-2", "mode-3", "mode-4", "is-grid", "has-maximized");

  // 布局切换按钮 (仅 4 个模型时显示)
  if (count === 4) {
    layoutToggle.style.display = "flex";
    layoutBtn.textContent = layoutMode === "grid" ? "||" : "⊞";
    layoutBtn.title = layoutMode === "grid" ? "切换布局：平铺" : "切换布局：四宫格";
  } else {
    layoutToggle.style.display = "none";
  }

  if (count > 0) {
    grid.classList.add(`mode-${count}`);
    if (count === 4 && layoutMode === "grid") {
      grid.classList.add("is-grid");
    }
  }

  // === 新增的卡片: 创建并飞入 ===
  const createPromises = [];
  added.forEach((name, idx) => {
    const site = sites.find((s) => s.name === name);
    if (!site) return;
    const cell = createCell(site);
    cell.classList.add("card-fly-in");
    cell.style.setProperty("--i", idx);
    grid.appendChild(cell);
    createPromises.push(createWebview(site));
  });

  // 等待新 webview 创建完成 (createWebview 会立即将其隐藏)
  await Promise.all(createPromises);

  // 立即重定位: kept 卡片跟随新布局; 飞入/飞出卡片对应 webview 保持隐藏
  requestAnimationFrame(() => relayout());

  // 飞入动画结束后, 移除标记并再次重定位以显示新 webview
  if (added.length > 0) {
    const totalWait = 500 + 80 * (added.length - 1) + 100;
    setTimeout(() => {
      added.forEach((name) => {
        const site = sites.find((s) => s.name === name);
        if (!site) return;
        const cell = grid.querySelector(`.cell[data-label="${site.label}"]`);
        if (cell) cell.classList.remove("card-fly-in");
      });
      relayout();
    }, totalWait);
  }
}

// ===== 重新定位 child webviews =====
async function relayout() {
  const activeLabels = activeModels.map((name) => {
    const site = sites.find((s) => s.name === name);
    return site ? site.label : null;
  }).filter(Boolean);
  await layoutWebviews(activeLabels);
}

// ===== 布局切换 =====
layoutBtn.addEventListener("click", () => {
  if (activeModels.length === 4) {
    layoutMode = layoutMode === "grid" ? "row" : "grid";
    updateLayout();
  }
});

// ===== 窗口 resize 时重新定位 (debounce) =====
let resizeTimer = null;
window.addEventListener("resize", () => {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => relayout(), 100);
});

// ===== 登录状态监听 =====
onLoginStatus((payload) => {
  const { label, ready } = payload;
  const cell = grid.querySelector(`.cell[data-label="${label}"]`);
  if (!cell) return;
  const indicator = cell.querySelector(".status-indicator");
  const tip = cell.querySelector(".login-tip");
  if (ready) {
    indicator?.classList.add("ready");
    if (tip) tip.style.display = "none";
  } else {
    indicator?.classList.remove("ready");
    if (tip) tip.style.display = "inline";
  }
});

// ===== 核心发送逻辑 (纯 JS 模拟, 替代 Electron insertText) =====
async function sendToAll() {
  const text = mainInput.value;
  if (!text.trim()) return;

  const promises = activeModels.map(async (name) => {
    const site = sites.find((s) => s.name === name);
    if (!site) return;
    const script = buildSendScript(site, text);
    await evalInWebview(site.label, script);
  });

  await Promise.all(promises);
  mainInput.value = "";
  mainInput.focus();
}

/**
 * 构造发送脚本: 聚焦输入框 → 插入文本 → 发送 (点击/回车)
 * 所有用户文本经 JSON.stringify 安全嵌入, 避免引号注入
 */
function buildSendScript(site, text) {
  const textJson = JSON.stringify(text);
  const inputSel = JSON.stringify(site.inputSelector);
  const buttonSel = JSON.stringify(site.buttonSelector);
  const submitType = JSON.stringify(site.submitType);
  const nameJson = JSON.stringify(site.name);
  const needsBeforeInput = site.needsBeforeInput ? "true" : "false";
  return `(function(){
    var text = ${textJson};
    var input = document.querySelector(${inputSel});
    if (!input) return;
    if (${nameJson} === '文心一言') { input.click(); }
    input.focus();
    setTimeout(function(){
      if (input.isContentEditable) {
        var range = document.createRange();
        range.selectNodeContents(input);
        range.collapse(true);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        if (${needsBeforeInput}) {
          input.dispatchEvent(new InputEvent('beforeinput', {
            bubbles: true, cancelable: true, inputType: 'insertText', data: text
          }));
        }
        document.execCommand('insertText', false, text);
        if (${needsBeforeInput}) {
          input.dispatchEvent(new InputEvent('input', {
            bubbles: true, inputType: 'insertText', data: text
          }));
        }
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        var setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set
                  || Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        if (setter) { setter.call(input, text); }
        else { input.value = text; }
        input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      setTimeout(function(){
        var btn = ${buttonSel} ? document.querySelector(${buttonSel}) : null;
        var shouldClick = btn && ${submitType} !== 'enter';
        function simulateEnter(el) {
          var opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true };
          el.dispatchEvent(new KeyboardEvent('keydown', opts));
          el.dispatchEvent(new KeyboardEvent('keypress', opts));
          el.dispatchEvent(new KeyboardEvent('keyup', opts));
        }
        if (shouldClick) {
          btn.click();
        } else {
          simulateEnter(input);
        }
      }, 500);
    }, 200);
  })();`;
}

// ===== 事件绑定 =====
sendBtn.addEventListener("click", sendToAll);
mainInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendToAll();
  }
});

// ===== 启动 =====
updateLayout();

// Tauri invoke 命令: child webview 生命周期管理
use serde::Deserialize;
use tauri::{LogicalPosition, LogicalSize, Manager, WebviewBuilder, WebviewUrl};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWebviewArgs {
    pub label: String,
    pub url: String,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub user_agent: String,
    pub init_script: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CellBounds {
    pub label: String,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub visible: bool,
}

/// 创建 child webview 加载外部 AI 站点
#[tauri::command]
pub async fn create_webview(app: tauri::AppHandle, args: CreateWebviewArgs) -> Result<(), String> {
    let window = app
        .get_window("main")
        .ok_or("main window not found".to_string())?;
    let url: url::Url = args
        .url
        .parse()
        .map_err(|e: url::ParseError| e.to_string())?;
    let builder = WebviewBuilder::new(&args.label, WebviewUrl::External(url))
        .user_agent(&args.user_agent)
        .initialization_script(&args.init_script);
    window
        .add_child(
            builder,
            LogicalPosition::new(args.x, args.y),
            LogicalSize::new(args.w, args.h),
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 重新定位/显示/隐藏所有 child webviews
#[tauri::command]
pub async fn layout_webviews(app: tauri::AppHandle, cells: Vec<CellBounds>) -> Result<(), String> {
    for cell in cells {
        let Some(webview) = app.get_webview(&cell.label) else {
            continue;
        };
        if cell.visible {
            let _ = webview.show();
            let _ = webview.set_position(LogicalPosition::new(cell.x, cell.y));
            let _ = webview.set_size(LogicalSize::new(cell.w, cell.h));
        } else {
            let _ = webview.hide();
        }
    }
    Ok(())
}

/// 在指定 webview 中执行 JS (替代 Electron executeJavaScript, 无返回值)
#[tauri::command]
pub async fn eval_in_webview(
    app: tauri::AppHandle,
    label: String,
    script: String,
) -> Result<(), String> {
    let webview = app
        .get_webview(&label)
        .ok_or(format!("webview {label} not found"))?;
    webview.eval(&script).map_err(|e| e.to_string())?;
    Ok(())
}

/// 刷新指定 webview (重新加载当前页, 保留会话)
#[tauri::command]
pub async fn reload_webview(app: tauri::AppHandle, label: String) -> Result<(), String> {
    let webview = app
        .get_webview(&label)
        .ok_or(format!("webview {label} not found"))?;
    webview
        .eval("location.reload()")
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// 在系统默认浏览器中打开 URL
#[tauri::command]
pub async fn open_in_browser(url: String) -> Result<(), String> {
    opener::open(&url).map_err(|e| e.to_string())?;
    Ok(())
}

/// 获取指定 webview 当前 URL
#[tauri::command]
pub async fn get_webview_url(app: tauri::AppHandle, label: String) -> Result<String, String> {
    let webview = app
        .get_webview(&label)
        .ok_or(format!("webview {label} not found"))?;
    let url = webview.url().map_err(|e| e.to_string())?;
    Ok(url.to_string())
}

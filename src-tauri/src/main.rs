#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use tauri::{Emitter, Manager, WebviewUrl};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        // 自定义 URI scheme: child webview 通过 fetch('aiinone://status?...')
        // 回传登录状态, Rust 拦截后 emit 事件给前端
        .register_uri_scheme_protocol("aiinone", |ctx, request| {
            let uri = request.uri().to_string();
            if let Some(query) = uri.split('?').nth(1) {
                let mut label = String::new();
                let mut ready = false;
                for pair in query.split('&') {
                    let mut kv = pair.splitn(2, '=');
                    match kv.next() {
                        Some("label") => label = kv.next().unwrap_or("").to_string(),
                        Some("ready") => ready = kv.next() == Some("true"),
                        _ => {}
                    }
                }
                if !label.is_empty() {
                    let _ = ctx.app_handle().emit(
                        "login-status",
                        serde_json::json!({ "label": label, "ready": ready }),
                    );
                }
            }
            tauri::http::Response::builder()
                .status(200)
                .header("Access-Control-Allow-Origin", "*")
                .body(Vec::new())
                .unwrap()
        })
        .setup(|app| {
            // ===== 1. 创建主窗口 =====
            let window = tauri::window::WindowBuilder::new(app, "main")
                .title("AI IN ONE - 聚合AI助手")
                .inner_size(1400.0, 900.0)
                .min_inner_size(800.0, 600.0)
                .build()
                .map_err(|e| format!("Failed to create main window: {}", e))?;

            // ===== 2. 持久化数据目录 =====
            let data_dir = app
                .path()
                .app_data_dir()
                .map(|p| p.join("webview-data"))
                .unwrap_or_else(|_| std::path::PathBuf::from("webview-data"));
            let _ = std::fs::create_dir_all(&data_dir);

            // ===== 3. 前端 webview =====
            if let Err(e) = window.add_child(
                tauri::webview::WebviewBuilder::new(
                    "frontend",
                    WebviewUrl::App("index.html".into()),
                )
                .auto_resize()
                .data_directory(data_dir),
                tauri::LogicalPosition::new(0.0, 0.0),
                tauri::LogicalSize::new(1400.0, 900.0),
            ) {
                eprintln!("Warning: Failed to create frontend webview: {}", e);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_webview,
            commands::layout_webviews,
            commands::eval_in_webview,
            commands::reload_webview,
            commands::open_in_browser,
            commands::get_webview_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

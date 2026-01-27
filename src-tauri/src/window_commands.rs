//window_commands.rs contains the commands for the window
use log::error;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, WebviewWindowBuilder};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct MonitorInfo {
    pub name: String,
    pub position: (i32, i32),
    pub size: (u32, u32),
    pub scale_factor: f64,
}

#[tauri::command]
pub async fn get_monitors(app_handle: AppHandle) -> Result<Vec<MonitorInfo>, String> {
    let monitors = app_handle
        .available_monitors()
        .map_err(|e| format!("Failed to get monitors: {}", e))?;

    let monitor_infos: Vec<MonitorInfo> = monitors
        .iter()
        .enumerate()
        .map(|(index, monitor)| {
            let name = monitor.name()
                .map(|n| n.to_string())
                .unwrap_or_else(|| format!("Monitor {}", index + 1));
            
            let position = monitor.position();
            let size = monitor.size();
            let scale_factor = monitor.scale_factor();

            MonitorInfo {
                name,
                position: (position.x, position.y),
                size: (size.width, size.height),
                scale_factor,
            }
        })
        .collect();

    Ok(monitor_infos)
}

#[tauri::command]
pub async fn open_dialog(
    app_handle: AppHandle,
    _webview_window: tauri::WebviewWindow,
    dialog_window: String,
    monitor_index: Option<usize>,
) -> Result<(), String> {
    // Check if this is the second screen request
    if dialog_window == "second-screen" {
        // Use separate binary for second screen as requested
        let url = "http://localhost:1420/display.html";
        
        // In development, we use cargo run --bin
        #[cfg(debug_assertions)]
        let _status = Command::new("cargo")
            .args(["run", "--bin", "display_window", "--", url])
            .spawn()
            .map_err(|e| format!("Failed to spawn display process: {}", e))?;

        #[cfg(not(debug_assertions))]
        {
            // In production, we expect the binary to be bundled side-by-side or handled differently.
            // For now, this placeholder reminds us to configure externalBin.
            // Assuming the binary is named 'display_window' (or display_window.exe on Windows) next to the main executable.
            let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
            let current_dir = current_exe.parent().ok_or("Failed to get current dir")?;
            let display_binary = current_dir.join("display_window.exe"); // Windows assumption
            
            Command::new(display_binary)
                .arg(url)
                .spawn()
                .map_err(|e| format!("Failed to spawn display process: {}", e))?;
        }

        return Ok(());
    }

    // Existing logic for other dialogs (if any)
    open_dialog_impl(app_handle, dialog_window, monitor_index)
        .await
        .map_err(|e| e.to_string())
}

async fn open_dialog_impl(
    handle: AppHandle,
    dialog_window: String,
    monitor_index: Option<usize>,
) -> Result<(), String> {
    let dialog_label = format!("dialog-{}", dialog_window);
    let title = dialog_window.clone();

    if let Some(existing_window) = handle.get_webview_window(&dialog_label) {
        if let Err(e) = existing_window.set_focus() {
            error!("Error focusing the dialog window: {:?}", e);
        }
    } else {
        // Check if this is the second screen window
        let is_second_screen = dialog_window == "second-screen";
        
        // Define the URL to load.
        // For the second screen, we load the specialized lightweight HTML file to avoid React app conflicts.
        let url = if is_second_screen {
            tauri::WebviewUrl::App("window.html".into())
        } else {
            tauri::WebviewUrl::default()
        };
        
        let mut builder = WebviewWindowBuilder::new(&handle, &dialog_label, url)
            .title(title)
            .decorations(!is_second_screen) // Borderless for second screen
            .inner_size(800.0, 600.0)
            .min_inner_size(800.0, 600.0);

        // Calculate position if a monitor is selected
        if let Some(index) = monitor_index {
            if let Ok(monitors) = handle.available_monitors() {
                if let Some(monitor) = monitors.get(index) {
                    let monitor_position = monitor.position();
                    let monitor_size = monitor.size();
                    let scale_factor = monitor.scale_factor();
                    
                    if is_second_screen {
                        // For second screen: set size to match monitor and position at monitor origin
                        let monitor_width_logical = monitor_size.width as f64 / scale_factor;
                        let monitor_height_logical = monitor_size.height as f64 / scale_factor;
                        let monitor_x_logical = monitor_position.x as f64 / scale_factor;
                        let monitor_y_logical = monitor_position.y as f64 / scale_factor;
                        
                        builder = builder
                            .inner_size(monitor_width_logical, monitor_height_logical)
                            .position(monitor_x_logical, monitor_y_logical);
                    } else {
                        // For other windows: center on monitor
                        let window_width = 800.0;
                        let window_height = 600.0;
                        
                        let monitor_x_logical = monitor_position.x as f64 / scale_factor;
                        let monitor_y_logical = monitor_position.y as f64 / scale_factor;
                        let monitor_width_logical = monitor_size.width as f64 / scale_factor;
                        let monitor_height_logical = monitor_size.height as f64 / scale_factor;
                        
                        let x = monitor_x_logical + (monitor_width_logical / 2.0) - (window_width / 2.0);
                        let y = monitor_y_logical + (monitor_height_logical / 2.0) - (window_height / 2.0);
                        
                        builder = builder.position(x, y);
                    }
                } else {
                    // Fallback to center if monitor index is invalid
                    builder = builder.center();
                }
            } else {
                // Fallback to center if monitors can't be retrieved
                builder = builder.center();
            }
        } else {
            // Default to center if no monitor is selected
            builder = builder.center();
        }

        // Build the window
        let builder_res = builder.build();
        
        match builder_res {
            Ok(window) => {
                // Set fullscreen for second screen
                if is_second_screen {
                    if let Err(e) = window.set_fullscreen(true) {
                        error!("Failed to set fullscreen: {:?}", e);
                    }
                }
            },
            Err(e) => {
                error!("Failed to build window: {:?}", e);
                return Err(format!("Failed to build window: {}", e));
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn update_second_screen_number(
    app_handle: AppHandle,
    number: String,
) -> Result<(), String> {
    // Emit event to all windows, but specifically the second screen will listen
    let windows = app_handle.webview_windows();
    for (_, window) in windows.iter() {
        if let Err(e) = window.emit("number-updated", &number) {
            error!("Failed to emit event to window {}: {:?}", window.label(), e);
        }
    }
    Ok(())
}

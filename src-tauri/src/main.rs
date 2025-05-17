// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn write_text_to_file(file_path: String, content: String) -> Result<(), String> {
    use std::fs::{File, create_dir_all};
    use std::io::Write;
    use std::path::Path;

    let path = Path::new(&file_path);
    if let Some(parent_dir) = path.parent() {
        if !parent_dir.exists() {
            create_dir_all(parent_dir).map_err(|e| e.to_string())?;
        }
    }
    let mut file = File::create(file_path).map_err(|e| e.to_string())?;
    file.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            greet,
            write_text_to_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

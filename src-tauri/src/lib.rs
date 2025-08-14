// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// Command to write text content to a file, creating parent directories as needed
#[tauri::command]
fn write_text_to_file(file_path: String, content: String) -> Result<(), String> {
    use std::fs::{create_dir_all, File};
    use std::io::Write;
    use std::path::Path;

    let path = Path::new(&file_path);
    if let Some(parent_dir) = path.parent() {
        if !parent_dir.exists() {
            create_dir_all(parent_dir).map_err(|e| e.to_string())?;
        }
    }
    let mut file = File::create(&file_path).map_err(|e| {
        format!("create_failed:{}:{}", file_path, e)
    })?;
    file
        .write_all(content.as_bytes())
        .map_err(|e| format!("write_failed:{}:{}", file_path, e))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, write_text_to_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

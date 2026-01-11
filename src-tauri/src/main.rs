// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Keep all command/plugin wiring in `src-tauri/src/lib.rs` so the frontend can
    // reliably `invoke()` commands like `start_live_slides_server`.
    proassist_lib::run();
}

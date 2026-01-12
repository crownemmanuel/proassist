// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
// (Note) Keep Tauri command wiring in this file; `src-tauri/src/main.rs` delegates to `run()`.
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::tungstenite::Message;

// ============================================================================
// Types for Live Slides
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveSlideItem {
    pub text: String,
    pub is_sub_item: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveSlide {
    pub items: Vec<LiveSlideItem>,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveSlideSession {
    pub id: String,
    pub name: String,
    pub slides: Vec<LiveSlide>,
    pub raw_text: String,
    pub created_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveSlidesState {
    pub sessions: HashMap<String, LiveSlideSession>,
    pub server_running: bool,
    pub server_port: u16,
    pub local_ip: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WsMessage {
    // From notepad to server
    #[serde(rename = "text_update")]
    TextUpdate { session_id: String, text: String },
    #[serde(rename = "join_session")]
    JoinSession { session_id: String, client_type: String },
    
    // From server to clients
    #[serde(rename = "slides_update")]
    SlidesUpdate { session_id: String, slides: Vec<LiveSlide>, raw_text: String },
    #[serde(rename = "session_created")]
    SessionCreated { session: LiveSlideSession },
    #[serde(rename = "session_deleted")]
    SessionDeleted { session_id: String },
    #[serde(rename = "error")]
    Error { message: String },
}

// Global state for the WebSocket server
struct ServerState {
    sessions: RwLock<HashMap<String, LiveSlideSession>>,
    broadcast_tx: broadcast::Sender<String>,
    running: RwLock<bool>,
    port: RwLock<u16>,
}

lazy_static::lazy_static! {
    static ref SERVER_STATE: Arc<ServerState> = Arc::new(ServerState {
        sessions: RwLock::new(HashMap::new()),
        broadcast_tx: broadcast::channel(100).0,
        running: RwLock::new(false),
        port: RwLock::new(9876),
    });
}

// Slide colors palette
const SLIDE_COLORS: [&str; 8] = [
    "#3B82F6", // Blue
    "#F59E0B", // Yellow/Amber
    "#EC4899", // Pink
    "#10B981", // Green
    "#8B5CF6", // Purple
    "#EF4444", // Red
    "#06B6D4", // Cyan
    "#F97316", // Orange
];

// ============================================================================
// Text Parsing Logic
// ============================================================================

fn parse_notepad_text(text: &str) -> Vec<LiveSlide> {
    let mut slides: Vec<LiveSlide> = Vec::new();
    let mut color_index = 0;
    let lines: Vec<&str> = text.lines().collect();
    let mut i = 0;

    while i < lines.len() {
        let line = lines[i];
        
        if line.trim().is_empty() {
            // Empty line = new slide boundary
            i += 1;
            continue;
        }
        
        if line.starts_with('\t') || line.starts_with("    ") {
            // Orphaned indented line (no parent) - treat as regular line
            let trimmed = line.trim_start_matches('\t').trim_start_matches("    ").trim_start();
            slides.push(LiveSlide {
                items: vec![LiveSlideItem {
                    text: trimmed.to_string(),
                    is_sub_item: false,
                }],
                color: SLIDE_COLORS[color_index % SLIDE_COLORS.len()].to_string(),
            });
            color_index += 1;
            i += 1;
        } else {
            // Regular line - this is a parent
            let parent_text = line.to_string();
            
            // Collect all immediately following indented lines
            let mut children: Vec<String> = Vec::new();
            let mut j = i + 1;
            while j < lines.len() {
                let next_line = lines[j];
                if next_line.trim().is_empty() {
                    break; // Empty line stops the group
                }
                if next_line.starts_with('\t') || next_line.starts_with("    ") {
                    let trimmed = next_line.trim_start_matches('\t').trim_start_matches("    ").trim_start();
                    children.push(trimmed.to_string());
                    j += 1;
                } else {
                    break; // Non-indented line stops the group
                }
            }
            
            if children.is_empty() {
                // No children - create single slide with just parent
                slides.push(LiveSlide {
                    items: vec![LiveSlideItem {
                        text: parent_text,
                        is_sub_item: false,
                    }],
                    color: SLIDE_COLORS[color_index % SLIDE_COLORS.len()].to_string(),
                });
                color_index += 1;
            } else {
                // Has children - create parent-only slide first, then one slide per child
                // First: parent-only slide
                slides.push(LiveSlide {
                    items: vec![LiveSlideItem {
                        text: parent_text.clone(),
                        is_sub_item: false,
                    }],
                    color: SLIDE_COLORS[color_index % SLIDE_COLORS.len()].to_string(),
                });
                color_index += 1;
                
                // Then: one slide per child (parent + child)
                for child in children {
                    slides.push(LiveSlide {
                        items: vec![
                            LiveSlideItem {
                                text: parent_text.clone(),
                                is_sub_item: false,
                            },
                            LiveSlideItem {
                                text: child,
                                is_sub_item: true,
                            },
                        ],
                        color: SLIDE_COLORS[color_index % SLIDE_COLORS.len()].to_string(),
                    });
                    color_index += 1;
                }
            }
            
            i = j; // Move past all processed lines
        }
    }

    slides
}

// ============================================================================
// WebSocket Server
// ============================================================================

async fn handle_ws_connection(
    ws_stream: tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>,
    state: Arc<ServerState>,
) {
    let (mut ws_sender, mut ws_receiver) = ws_stream.split();
    let mut broadcast_rx = state.broadcast_tx.subscribe();
    
    // Spawn task to forward broadcasts to this client
    let forward_task = tokio::spawn(async move {
        while let Ok(msg) = broadcast_rx.recv().await {
            if ws_sender.send(Message::Text(msg)).await.is_err() {
                break;
            }
        }
    });

    // Handle incoming messages
    while let Some(msg) = ws_receiver.next().await {
        if let Ok(Message::Text(text)) = msg {
            if let Ok(ws_msg) = serde_json::from_str::<WsMessage>(&text) {
                match ws_msg {
                    WsMessage::TextUpdate { session_id, text } => {
                        let slides = parse_notepad_text(&text);
                        
                        // Update session
                        {
                            let mut sessions = state.sessions.write().await;
                            if let Some(session) = sessions.get_mut(&session_id) {
                                session.slides = slides.clone();
                                session.raw_text = text.clone();
                            }
                        }
                        
                        // Broadcast update to all clients
                        let update = WsMessage::SlidesUpdate {
                            session_id,
                            slides,
                            raw_text: text,
                        };
                        if let Ok(json) = serde_json::to_string(&update) {
                            let _ = state.broadcast_tx.send(json);
                        }
                    }
                    WsMessage::JoinSession { session_id, client_type: _ } => {
                        // Send current session state to the joining client
                        let sessions = state.sessions.read().await;
                        if let Some(session) = sessions.get(&session_id) {
                            let update = WsMessage::SlidesUpdate {
                                session_id: session_id.clone(),
                                slides: session.slides.clone(),
                                raw_text: session.raw_text.clone(),
                            };
                            if let Ok(json) = serde_json::to_string(&update) {
                                let _ = state.broadcast_tx.send(json);
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
    }
    
    forward_task.abort();
}

async fn run_websocket_server(listener: tokio::net::TcpListener) -> Result<(), String> {
    let state = SERVER_STATE.clone();

    while *state.running.read().await {
        tokio::select! {
            result = listener.accept() => {
                if let Ok((stream, _)) = result {
                    let ws_stream = tokio_tungstenite::accept_async(stream)
                        .await
                        .map_err(|e| format!("WebSocket handshake failed: {}", e))?;
                    
                    let state_clone = state.clone();
                    tokio::spawn(async move {
                        handle_ws_connection(ws_stream, state_clone).await;
                    });
                }
            }
            _ = tokio::time::sleep(tokio::time::Duration::from_millis(100)) => {
                // Check if we should stop
                if !*state.running.read().await {
                    break;
                }
            }
        }
    }
    
    Ok(())
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

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

#[tauri::command]
async fn start_live_slides_server(port: u16) -> Result<String, String> {
    let state = SERVER_STATE.clone();
    
    // Check if already running
    if *state.running.read().await {
        return Err("Server is already running".to_string());
    }
    
    // Bind first so we can return a helpful error (e.g., "port already in use")
    // instead of spawning a task that fails silently.
    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .map_err(|e| format!("Failed to bind to {}: {}", addr, e))?;

    println!("WebSocket server listening on {}", addr);

    *state.running.write().await = true;
    *state.port.write().await = port;
    
    // Start server in background
    tokio::spawn(async move {
        if let Err(e) = run_websocket_server(listener).await {
            eprintln!("WebSocket server error: {}", e);
        }
    });
    
    // Get local IP
    let local_ip = local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| {
            // Fallback to localhost if IP detection fails
            eprintln!("Warning: Failed to detect local IP, using 127.0.0.1");
            "127.0.0.1".to_string()
        });
    
    Ok(format!("ws://{}:{}", local_ip, port))
}

#[tauri::command]
async fn stop_live_slides_server() -> Result<(), String> {
    let state = SERVER_STATE.clone();
    *state.running.write().await = false;
    Ok(())
}

#[tauri::command]
async fn create_live_slide_session(name: String) -> Result<LiveSlideSession, String> {
    let state = SERVER_STATE.clone();
    
    let session_id = uuid::Uuid::new_v4().to_string();
    let session = LiveSlideSession {
        id: session_id.clone(),
        name,
        slides: Vec::new(),
        raw_text: String::new(),
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    };
    
    state.sessions.write().await.insert(session_id, session.clone());
    
    // Broadcast session creation
    let msg = WsMessage::SessionCreated { session: session.clone() };
    if let Ok(json) = serde_json::to_string(&msg) {
        let _ = state.broadcast_tx.send(json);
    }
    
    Ok(session)
}

#[tauri::command]
async fn delete_live_slide_session(session_id: String) -> Result<(), String> {
    let state = SERVER_STATE.clone();
    
    state.sessions.write().await.remove(&session_id);
    
    // Broadcast session deletion
    let msg = WsMessage::SessionDeleted { session_id };
    if let Ok(json) = serde_json::to_string(&msg) {
        let _ = state.broadcast_tx.send(json);
    }
    
    Ok(())
}

#[tauri::command]
async fn get_live_slide_sessions() -> Result<Vec<LiveSlideSession>, String> {
    let state = SERVER_STATE.clone();
    let sessions = state.sessions.read().await;
    Ok(sessions.values().cloned().collect())
}

#[tauri::command]
async fn get_live_slides_server_info() -> Result<LiveSlidesState, String> {
    let state = SERVER_STATE.clone();
    
    let sessions = state.sessions.read().await.clone();
    let running = *state.running.read().await;
    let port = *state.port.read().await;
    
    let local_ip = local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "localhost".to_string());
    
    Ok(LiveSlidesState {
        sessions,
        server_running: running,
        server_port: port,
        local_ip,
    })
}

#[tauri::command]
fn get_local_ip() -> String {
    local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "localhost".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            write_text_to_file,
            start_live_slides_server,
            stop_live_slides_server,
            create_live_slide_session,
            delete_live_slide_session,
            get_live_slide_sessions,
            get_live_slides_server_info,
            get_local_ip
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

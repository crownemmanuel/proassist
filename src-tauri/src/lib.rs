// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
// (Note) Keep Tauri command wiring in this file; `src-tauri/src/main.rs` delegates to `run()`.
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use futures_util::{SinkExt, StreamExt};
use warp::Filter;
use warp::ws::{Message as WarpWsMessage, WebSocket};
use rust_embed::RustEmbed;
use cpal::traits::{DeviceTrait, HostTrait};

// ============================================================================
// Embedded Frontend Assets
// ============================================================================

#[derive(RustEmbed)]
#[folder = "../dist"]
struct FrontendAssets;

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

// ============================================================================
// Types for Schedule
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleItem {
    pub id: i32,
    pub session: String,
    pub start_time: String,
    pub end_time: String,
    pub duration: String,
    pub minister: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleState {
    pub schedule: Vec<ScheduleItem>,
    pub current_session_index: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimerState {
    pub is_running: bool,
    pub time_left: i32, // seconds
    pub session_name: Option<String>,
    pub end_time: Option<String>,
    pub is_overrun: bool,
}

// ============================================================================
// Types for Network Sync
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncServerInfo {
    pub running: bool,
    pub port: u16,
    pub local_ip: String,
    pub connected_clients: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SyncMessage {
    #[serde(rename = "sync_playlist_item")]
    PlaylistItem {
        #[serde(rename = "playlistId")]
        playlist_id: String,
        item: serde_json::Value, // PlaylistItem as JSON
        action: String, // "create" | "update"
        timestamp: u64,
    },
    #[serde(rename = "sync_playlist_delete")]
    PlaylistDelete {
        #[serde(rename = "playlistId")]
        playlist_id: String,
        #[serde(rename = "itemId")]
        item_id: String,
        timestamp: u64,
    },
    #[serde(rename = "sync_schedule")]
    Schedule {
        schedule: Vec<ScheduleItem>,
        #[serde(rename = "currentSessionIndex")]
        current_session_index: Option<usize>,
        timestamp: u64,
    },
    #[serde(rename = "sync_request_state")]
    RequestState {
        #[serde(rename = "requestPlaylists")]
        request_playlists: bool,
        #[serde(rename = "requestSchedule")]
        request_schedule: bool,
    },
    #[serde(rename = "sync_full_state")]
    FullState {
        playlists: Option<serde_json::Value>, // Playlist[] as JSON
        schedule: Option<Vec<ScheduleItem>>,
        #[serde(rename = "currentSessionIndex")]
        current_session_index: Option<usize>,
        timestamp: u64,
    },
    #[serde(rename = "sync_join")]
    Join {
        #[serde(rename = "clientMode")]
        client_mode: String,
        #[serde(rename = "clientId")]
        client_id: String,
    },
    #[serde(rename = "sync_welcome")]
    Welcome {
        #[serde(rename = "serverId")]
        server_id: String,
        #[serde(rename = "serverMode")]
        server_mode: String,
        #[serde(rename = "connectedClients")]
        connected_clients: i32,
    },
    #[serde(rename = "sync_error")]
    Error {
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WsMessage {
    // From notepad to server
    #[serde(rename = "text_update")]
    TextUpdate { session_id: String, text: String },
    #[serde(rename = "join_session")]
    JoinSession { session_id: String, client_type: String },
    #[serde(rename = "join_schedule")]
    JoinSchedule,
    
    // From server to clients
    #[serde(rename = "slides_update")]
    SlidesUpdate { session_id: String, slides: Vec<LiveSlide>, raw_text: String },
    #[serde(rename = "session_created")]
    SessionCreated { session: LiveSlideSession },
    #[serde(rename = "session_deleted")]
    SessionDeleted { session_id: String },
    #[serde(rename = "schedule_update")]
    ScheduleUpdate { 
        schedule: Vec<ScheduleItem>, 
        #[serde(rename = "currentSessionIndex")]
        current_session_index: Option<usize> 
    },
    #[serde(rename = "timer_update")]
    TimerUpdate { timer_state: TimerState },
    #[serde(rename = "join_timer")]
    JoinTimer,
    #[serde(rename = "error")]
    Error { message: String },
}

// Global state for the WebSocket server
struct ServerState {
    sessions: RwLock<HashMap<String, LiveSlideSession>>,
    schedule: RwLock<ScheduleState>,
    timer_state: RwLock<TimerState>,
    broadcast_tx: broadcast::Sender<String>,
    running: RwLock<bool>,
    port: RwLock<u16>,
    shutdown_tx: RwLock<Option<tokio::sync::oneshot::Sender<()>>>,
}

// Global state for the Network Sync server
struct SyncServerState {
    broadcast_tx: broadcast::Sender<String>,
    running: RwLock<bool>,
    port: RwLock<u16>,
    shutdown_tx: RwLock<Option<tokio::sync::oneshot::Sender<()>>>,
    connected_clients: RwLock<i32>,
    server_id: String,
    server_mode: RwLock<String>,
    // Cached state for sending to new clients
    playlists: RwLock<Option<serde_json::Value>>,
    schedule: RwLock<Option<Vec<ScheduleItem>>>,
    current_session_index: RwLock<Option<usize>>,
}

lazy_static::lazy_static! {
    static ref SERVER_STATE: Arc<ServerState> = Arc::new(ServerState {
        sessions: RwLock::new(HashMap::new()),
        schedule: RwLock::new(ScheduleState {
            schedule: Vec::new(),
            current_session_index: None,
        }),
        timer_state: RwLock::new(TimerState {
            is_running: false,
            time_left: 0,
            session_name: None,
            end_time: None,
            is_overrun: false,
        }),
        broadcast_tx: broadcast::channel(100).0,
        running: RwLock::new(false),
        port: RwLock::new(9876),
        shutdown_tx: RwLock::new(None),
    });
    
    static ref SYNC_SERVER_STATE: Arc<SyncServerState> = Arc::new(SyncServerState {
        broadcast_tx: broadcast::channel(100).0,
        running: RwLock::new(false),
        port: RwLock::new(9877),
        shutdown_tx: RwLock::new(None),
        connected_clients: RwLock::new(0),
        server_id: uuid::Uuid::new_v4().to_string(),
        server_mode: RwLock::new("master".to_string()),
        // Store current state for new clients
        playlists: RwLock::new(None),
        schedule: RwLock::new(None),
        current_session_index: RwLock::new(None),
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
        
        // Skip empty lines - they create slide boundaries
        if line.trim().is_empty() {
            i += 1;
            continue;
        }
        
        // Check if this is an orphaned indented line (no parent before it)
        if line.starts_with('\t') || line.starts_with("    ") {
            // Orphaned indented line - treat as regular line
            let trimmed = line
                .trim_start_matches('\t')
                .trim_start_matches("    ")
                .trim_start()
                .to_string();
            if !trimmed.is_empty() {
                slides.push(LiveSlide {
                    items: vec![LiveSlideItem {
                        text: trimmed,
                        is_sub_item: false,
                    }],
                    color: SLIDE_COLORS[color_index % SLIDE_COLORS.len()].to_string(),
                });
                color_index += 1;
            }
            i += 1;
            continue;
        }
        
        // Regular line - check if it has indented children following it
        let parent_text = line.trim().to_string();
        if parent_text.is_empty() {
            i += 1;
            continue;
        }
        
        // Look ahead to see if there are indented lines following
        let mut children: Vec<String> = Vec::new();
        let mut j = i + 1;
        while j < lines.len() {
            let next_line = lines[j];
            if next_line.trim().is_empty() {
                break; // Empty line stops the group
            }
            if next_line.starts_with('\t') || next_line.starts_with("    ") {
                let trimmed = next_line
                    .trim_start_matches('\t')
                    .trim_start_matches("    ")
                    .trim_start()
                    .to_string();
                if !trimmed.is_empty() {
                    children.push(trimmed);
                }
                j += 1;
            } else {
                break; // Non-indented line stops the group
            }
        }
        
        if children.is_empty() {
            // No indented children - collect all consecutive non-indented lines into one slide
            // All items in this slide use the same color (blue - first color)
            let mut current_slide_items: Vec<LiveSlideItem> = Vec::new();
            let mut k = i;
            
            while k < lines.len() {
                let current_line = lines[k];
                
                // Empty line = end of current slide
                if current_line.trim().is_empty() {
                    break;
                }
                
                // If we hit an indented line, stop (that's a different pattern)
                if current_line.starts_with('\t') || current_line.starts_with("    ") {
                    break;
                }
                
                // Regular line = regular item
                let trimmed = current_line.trim().to_string();
                if !trimmed.is_empty() {
                    current_slide_items.push(LiveSlideItem {
                        text: trimmed,
                        is_sub_item: false,
                    });
                }
                k += 1;
            }
            
            if !current_slide_items.is_empty() {
                // Use blue (first color) for consecutive lines on same slide
                slides.push(LiveSlide {
                    items: current_slide_items,
                    color: SLIDE_COLORS[0].to_string(), // Always use blue for consecutive lines
                });
                // Don't increment color_index here - keep it for next slide boundary
            }
            
            i = k;
        } else {
            // Has indented children - use the parent+children pattern
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
            
            i = j; // Move past all processed lines
        }
    }

    slides
}

// ============================================================================
// WebSocket Handler (using warp)
// ============================================================================

async fn handle_ws_connection(ws: WebSocket, state: Arc<ServerState>) {
    let (mut ws_sender, mut ws_receiver) = ws.split();
    let mut broadcast_rx = state.broadcast_tx.subscribe();
    
    // Spawn task to forward broadcasts to this client
    let forward_task = tokio::spawn(async move {
        while let Ok(msg) = broadcast_rx.recv().await {
            if ws_sender.send(WarpWsMessage::text(msg)).await.is_err() {
                break;
            }
        }
    });

    // Handle incoming messages
    while let Some(result) = ws_receiver.next().await {
        if let Ok(msg) = result {
            if let Ok(text) = msg.to_str() {
                if let Ok(ws_msg) = serde_json::from_str::<WsMessage>(text) {
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
                        WsMessage::JoinSchedule => {
                            // Send current schedule state to the joining client
                            let schedule_state = state.schedule.read().await;
                            let update = WsMessage::ScheduleUpdate {
                                schedule: schedule_state.schedule.clone(),
                                current_session_index: schedule_state.current_session_index,
                            };
                            if let Ok(json) = serde_json::to_string(&update) {
                                let _ = state.broadcast_tx.send(json);
                            }
                        }
                        WsMessage::JoinTimer => {
                            // Send current timer state to the joining client
                            let timer_state = state.timer_state.read().await;
                            let update = WsMessage::TimerUpdate {
                                timer_state: timer_state.clone(),
                            };
                            if let Ok(json) = serde_json::to_string(&update) {
                                let _ = state.broadcast_tx.send(json);
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
    }
    
    forward_task.abort();
}

// ============================================================================
// Static File Server (using warp + rust-embed)
// ============================================================================

fn serve_embedded_file(path: &str) -> Option<(Vec<u8>, String)> {
    // Try exact path first
    if let Some(content) = FrontendAssets::get(path) {
        let mime = mime_guess::from_path(path).first_or_octet_stream();
        return Some((content.data.to_vec(), mime.to_string()));
    }
    
    // For SPA routing, return index.html for non-file paths
    if !path.contains('.') || path.ends_with('/') {
        if let Some(content) = FrontendAssets::get("index.html") {
            return Some((content.data.to_vec(), "text/html".to_string()));
        }
    }
    
    None
}

// ============================================================================
// Combined HTTP + WebSocket Server
// ============================================================================

async fn run_combined_server(port: u16) -> Result<(), String> {
    let state = SERVER_STATE.clone();
    
    // Create shutdown channel
    let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();
    *state.shutdown_tx.write().await = Some(shutdown_tx);
    
    // WebSocket route at /ws
    let ws_state = state.clone();
    let ws_route = warp::path("ws")
        .and(warp::ws())
        .map(move |ws: warp::ws::Ws| {
            let state_clone = ws_state.clone();
            ws.on_upgrade(move |socket| handle_ws_connection(socket, state_clone))
        });
    
    // Schedule API route
    let api_state = state.clone();
    let schedule_api_route = warp::path("api")
        .and(warp::path("schedule"))
        .and(warp::path::end())
        .and_then(move || {
            let state_clone = api_state.clone();
            async move {
                let schedule_state = state_clone.schedule.read().await;
                let response = serde_json::json!({
                    "schedule": schedule_state.schedule,
                    "currentSessionIndex": schedule_state.current_session_index,
                });
                Ok::<_, warp::Rejection>(warp::reply::json(&response))
            }
        });
    
    // Live Slides API route - exposes all sessions as JSON for master/slave sync
    let live_slides_api_state = state.clone();
    let live_slides_api_route = warp::path("api")
        .and(warp::path("live-slides"))
        .and(warp::path::end())
        .and_then(move || {
            let state_clone = live_slides_api_state.clone();
            async move {
                let sessions = state_clone.sessions.read().await;
                let session_list: Vec<&LiveSlideSession> = sessions.values().collect();
                let response = serde_json::json!({
                    "sessions": session_list,
                    "server_running": true,
                });
                Ok::<_, warp::Rejection>(warp::reply::json(&response))
            }
        });
    
    // Schedule view route - serve schedule-view.html
    let schedule_view_route = warp::path("schedule")
        .and(warp::path("view"))
        .and(warp::path::end())
        .map(|| {
            match serve_embedded_file("schedule-view.html") {
                Some((content, _)) => {
                    warp::http::Response::builder()
                        .header("Content-Type", "text/html")
                        .header("Access-Control-Allow-Origin", "*")
                        .body(content)
                        .unwrap()
                }
                None => {
                    warp::http::Response::builder()
                        .status(404)
                        .body(b"Schedule view not found".to_vec())
                        .unwrap()
                }
            }
        });
    
    // Static files route - serve embedded frontend assets
    let static_route = warp::path::tail()
        .map(|tail: warp::path::Tail| {
            let path = tail.as_str();
            let path = if path.is_empty() { "index.html" } else { path };
            
            match serve_embedded_file(path) {
                Some((content, mime)) => {
                    warp::http::Response::builder()
                        .header("Content-Type", mime)
                        .header("Access-Control-Allow-Origin", "*")
                        .body(content)
                        .unwrap()
                }
                None => {
                    // SPA fallback - serve index.html for unknown routes
                    if let Some((content, _)) = serve_embedded_file("index.html") {
                        warp::http::Response::builder()
                            .header("Content-Type", "text/html")
                            .header("Access-Control-Allow-Origin", "*")
                            .body(content)
                            .unwrap()
                    } else {
                        warp::http::Response::builder()
                            .status(404)
                            .body(b"Not Found".to_vec())
                            .unwrap()
                    }
                }
            }
        });
    
    // Root path - serve index.html
    let root_route = warp::path::end()
        .map(|| {
            match serve_embedded_file("index.html") {
                Some((content, mime)) => {
                    warp::http::Response::builder()
                        .header("Content-Type", mime)
                        .header("Access-Control-Allow-Origin", "*")
                        .body(content)
                        .unwrap()
                }
                None => {
                    warp::http::Response::builder()
                        .status(404)
                        .body(b"Not Found".to_vec())
                        .unwrap()
                }
            }
        });
    
    // CORS headers for all routes
    let cors = warp::cors()
        .allow_any_origin()
        .allow_methods(vec!["GET", "POST", "OPTIONS"])
        .allow_headers(vec!["Content-Type"]);
    
    // Combine routes: WebSocket first, then APIs, then schedule view, then static files
    let routes = ws_route
        .or(schedule_api_route)
        .or(live_slides_api_route)
        .or(schedule_view_route)
        .or(root_route)
        .or(static_route)
        .with(cors);
    
    let addr: std::net::SocketAddr = format!("0.0.0.0:{}", port)
        .parse()
        .map_err(|e| format!("Invalid address: {}", e))?;
    
    println!("Live Slides server (HTTP + WebSocket) listening on {}", addr);
    
    let (_, server) = warp::serve(routes)
        .bind_with_graceful_shutdown(addr, async {
            shutdown_rx.await.ok();
        });
    
    server.await;
    
    Ok(())
}

// ============================================================================
// Network Sync WebSocket Handler
// ============================================================================

async fn handle_sync_ws_connection(ws: WebSocket, state: Arc<SyncServerState>) {
    let (mut ws_sender, mut ws_receiver) = ws.split();
    let mut broadcast_rx = state.broadcast_tx.subscribe();
    
    // Increment connected clients
    {
        let mut count = state.connected_clients.write().await;
        *count += 1;
    }
    
    // Send welcome message
    let connected = *state.connected_clients.read().await;
    let server_mode = state.server_mode.read().await.clone();
    let welcome = SyncMessage::Welcome {
        server_id: state.server_id.clone(),
        server_mode,
        connected_clients: connected,
    };
    if let Ok(json) = serde_json::to_string(&welcome) {
        let _ = ws_sender.send(WarpWsMessage::text(json)).await;
    }
    
    // Spawn task to forward broadcasts to this client
    let forward_task = tokio::spawn(async move {
        while let Ok(msg) = broadcast_rx.recv().await {
            if ws_sender.send(WarpWsMessage::text(msg)).await.is_err() {
                break;
            }
        }
    });

    // Handle incoming messages
    while let Some(result) = ws_receiver.next().await {
        if let Ok(msg) = result {
            if let Ok(text) = msg.to_str() {
                if let Ok(sync_msg) = serde_json::from_str::<SyncMessage>(text) {
                    match sync_msg {
                        SyncMessage::Join { client_mode, client_id } => {
                            println!("Sync client joined: {} (mode: {})", client_id, client_mode);
                            // Send current state to the joining client
                            let playlists = state.playlists.read().await.clone();
                            let schedule = state.schedule.read().await.clone();
                            let current_idx = *state.current_session_index.read().await;
                            
                            let full_state = SyncMessage::FullState {
                                playlists,
                                schedule,
                                current_session_index: current_idx,
                                timestamp: std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .unwrap()
                                    .as_millis() as u64,
                            };
                            if let Ok(json) = serde_json::to_string(&full_state) {
                                let _ = state.broadcast_tx.send(json);
                            }
                        }
                        SyncMessage::RequestState { request_playlists, request_schedule } => {
                            let playlists = if request_playlists {
                                state.playlists.read().await.clone()
                            } else {
                                None
                            };
                            let schedule = if request_schedule {
                                state.schedule.read().await.clone()
                            } else {
                                None
                            };
                            let current_idx = if request_schedule {
                                *state.current_session_index.read().await
                            } else {
                                None
                            };
                            
                            let full_state = SyncMessage::FullState {
                                playlists,
                                schedule,
                                current_session_index: current_idx,
                                timestamp: std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .unwrap()
                                    .as_millis() as u64,
                            };
                            if let Ok(json) = serde_json::to_string(&full_state) {
                                let _ = state.broadcast_tx.send(json);
                            }
                        }
                        // For peer mode - forward incoming sync messages from other peers
                        SyncMessage::PlaylistItem { .. } | 
                        SyncMessage::PlaylistDelete { .. } |
                        SyncMessage::Schedule { .. } |
                        SyncMessage::FullState { .. } => {
                            // Rebroadcast to all connected clients
                            if let Ok(json) = serde_json::to_string(&sync_msg) {
                                let _ = state.broadcast_tx.send(json);
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
    }
    
    // Decrement connected clients on disconnect
    {
        let mut count = state.connected_clients.write().await;
        *count -= 1;
    }
    
    forward_task.abort();
}

async fn run_sync_server(port: u16) -> Result<(), String> {
    let state = SYNC_SERVER_STATE.clone();
    
    // Create shutdown channel
    let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();
    *state.shutdown_tx.write().await = Some(shutdown_tx);
    
    // WebSocket route at /sync
    let ws_state = state.clone();
    let ws_route = warp::path("sync")
        .and(warp::ws())
        .map(move |ws: warp::ws::Ws| {
            let state_clone = ws_state.clone();
            ws.on_upgrade(move |socket| handle_sync_ws_connection(socket, state_clone))
        });
    
    // CORS headers
    let cors = warp::cors()
        .allow_any_origin()
        .allow_methods(vec!["GET", "POST", "OPTIONS"])
        .allow_headers(vec!["Content-Type"]);
    
    let routes = ws_route.with(cors);
    
    let addr: std::net::SocketAddr = format!("0.0.0.0:{}", port)
        .parse()
        .map_err(|e| format!("Invalid address: {}", e))?;
    
    println!("Network Sync server listening on {}", addr);
    
    let (_, server) = warp::serve(routes)
        .bind_with_graceful_shutdown(addr, async {
            shutdown_rx.await.ok();
        });
    
    server.await;
    
    Ok(())
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// ============================================================================
// Audio Device Enumeration (Native)
// ============================================================================

#[derive(Debug, Clone, Serialize)]
pub struct NativeAudioInputDevice {
    pub name: String,
    pub is_default: bool,
}

#[tauri::command]
fn list_native_audio_input_devices() -> Result<Vec<NativeAudioInputDevice>, String> {
    let host = cpal::default_host();
    let default_name = host
        .default_input_device()
        .and_then(|d| d.name().ok());

    let mut devices: Vec<NativeAudioInputDevice> = host
        .input_devices()
        .map_err(|e| format!("input_devices_failed:{}", e))?
        .filter_map(|d| {
            let name = d.name().ok()?;
            let is_default = default_name.as_ref().map(|n| n == &name).unwrap_or(false);
            Some(NativeAudioInputDevice { name, is_default })
        })
        .collect();

    // Put default first, then alphabetical
    devices.sort_by(|a, b| {
        match (a.is_default, b.is_default) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(devices)
}

// ============================================================================
// AssemblyAI Token Generation (Tauri Backend)
// ============================================================================

#[derive(Debug, Deserialize)]
struct AssemblyAiTokenResponse {
    token: String,
}

#[tauri::command]
async fn assemblyai_create_realtime_token(
    api_key: String,
    expires_in: Option<u64>,
) -> Result<String, String> {
    let expires_in = expires_in.unwrap_or(3600);

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.assemblyai.com/v2/realtime/token")
        .header("Authorization", api_key)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "expires_in": expires_in }))
        .send()
        .await
        .map_err(|e| format!("assemblyai_token_request_failed:{}", e))?;

    let status = resp.status();
    let body = resp
        .text()
        .await
        .map_err(|e| format!("assemblyai_token_read_failed:{}", e))?;

    if !status.is_success() {
        return Err(format!(
            "assemblyai_token_failed:{}:{}",
            status.as_u16(),
            body
        ));
    }

    let parsed: AssemblyAiTokenResponse = serde_json::from_str(&body)
        .map_err(|e| format!("assemblyai_token_parse_failed:{}:{}", e, body))?;

    Ok(parsed.token)
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
    
    *state.running.write().await = true;
    *state.port.write().await = port;
    
    // Start combined HTTP + WebSocket server in background
    let port_clone = port;
    tokio::spawn(async move {
        if let Err(e) = run_combined_server(port_clone).await {
            eprintln!("Server error: {}", e);
        }
        // Mark as not running when server stops
        *SERVER_STATE.running.write().await = false;
    });
    
    // Small delay to let server start
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    
    // Get local IP
    let local_ip = local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| {
            eprintln!("Warning: Failed to detect local IP, using 127.0.0.1");
            "127.0.0.1".to_string()
        });
    
    Ok(format!("http://{}:{}", local_ip, port))
}

#[tauri::command]
async fn stop_live_slides_server() -> Result<(), String> {
    let state = SERVER_STATE.clone();
    
    // Send shutdown signal
    if let Some(tx) = state.shutdown_tx.write().await.take() {
        let _ = tx.send(());
    }
    
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

#[tauri::command]
async fn update_schedule(
    schedule: Vec<ScheduleItem>,
    current_session_index: Option<usize>,
) -> Result<(), String> {
    let state = SERVER_STATE.clone();
    
    // Update schedule state
    {
        let mut schedule_state = state.schedule.write().await;
        schedule_state.schedule = schedule.clone();
        schedule_state.current_session_index = current_session_index;
    }
    
    // Broadcast schedule update to all connected clients
    let update = WsMessage::ScheduleUpdate {
        schedule,
        current_session_index,
    };
    if let Ok(json) = serde_json::to_string(&update) {
        let _ = state.broadcast_tx.send(json);
    }
    
    Ok(())
}

#[tauri::command]
async fn update_timer_state(
    is_running: bool,
    time_left: i32,
    session_name: Option<String>,
    end_time: Option<String>,
    is_overrun: bool,
) -> Result<(), String> {
    let state = SERVER_STATE.clone();
    
    // Update timer state
    {
        let mut timer_state = state.timer_state.write().await;
        timer_state.is_running = is_running;
        timer_state.time_left = time_left;
        timer_state.session_name = session_name.clone();
        timer_state.end_time = end_time.clone();
        timer_state.is_overrun = is_overrun;
    }
    
    // Broadcast timer update to all connected clients
    let update = WsMessage::TimerUpdate {
        timer_state: TimerState {
            is_running,
            time_left,
            session_name,
            end_time,
            is_overrun,
        },
    };
    if let Ok(json) = serde_json::to_string(&update) {
        let _ = state.broadcast_tx.send(json);
    }
    
    Ok(())
}

// ============================================================================
// Network Sync Tauri Commands
// ============================================================================

#[tauri::command]
async fn start_sync_server(port: u16, mode: String) -> Result<SyncServerInfo, String> {
    let state = SYNC_SERVER_STATE.clone();
    
    // Check if already running
    if *state.running.read().await {
        return Err("Sync server is already running".to_string());
    }
    
    *state.running.write().await = true;
    *state.port.write().await = port;
    *state.server_mode.write().await = mode;
    
    // Start sync server in background
    let port_clone = port;
    tokio::spawn(async move {
        if let Err(e) = run_sync_server(port_clone).await {
            eprintln!("Sync server error: {}", e);
        }
        // Mark as not running when server stops
        *SYNC_SERVER_STATE.running.write().await = false;
    });
    
    // Small delay to let server start
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    
    // Get local IP
    let local_ip = local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string());
    
    Ok(SyncServerInfo {
        running: true,
        port,
        local_ip,
        connected_clients: 0,
    })
}

#[tauri::command]
async fn stop_sync_server() -> Result<(), String> {
    let state = SYNC_SERVER_STATE.clone();
    
    // Send shutdown signal
    if let Some(tx) = state.shutdown_tx.write().await.take() {
        let _ = tx.send(());
    }
    
    *state.running.write().await = false;
    *state.connected_clients.write().await = 0;
    Ok(())
}

#[tauri::command]
async fn get_sync_server_info() -> Result<SyncServerInfo, String> {
    let state = SYNC_SERVER_STATE.clone();
    
    let running = *state.running.read().await;
    let port = *state.port.read().await;
    let connected_clients = *state.connected_clients.read().await;
    
    let local_ip = local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "localhost".to_string());
    
    Ok(SyncServerInfo {
        running,
        port,
        local_ip,
        connected_clients,
    })
}

#[tauri::command]
async fn broadcast_sync_message(message: String) -> Result<(), String> {
    let state = SYNC_SERVER_STATE.clone();
    
    if !*state.running.read().await {
        return Err("Sync server is not running".to_string());
    }
    
    // Parse and update cached state if needed
    if let Ok(sync_msg) = serde_json::from_str::<SyncMessage>(&message) {
        match &sync_msg {
            SyncMessage::PlaylistItem { .. } | SyncMessage::PlaylistDelete { .. } => {
                // These are partial updates, we don't cache them individually
            }
            SyncMessage::Schedule { schedule, current_session_index, .. } => {
                *state.schedule.write().await = Some(schedule.clone());
                *state.current_session_index.write().await = *current_session_index;
            }
            SyncMessage::FullState { playlists, schedule, current_session_index, .. } => {
                if let Some(p) = playlists {
                    *state.playlists.write().await = Some(p.clone());
                }
                if let Some(s) = schedule {
                    *state.schedule.write().await = Some(s.clone());
                }
                *state.current_session_index.write().await = *current_session_index;
            }
            _ => {}
        }
    }
    
    state.broadcast_tx.send(message)
        .map_err(|e| format!("Failed to broadcast: {}", e))?;
    
    Ok(())
}

// ============================================================================
// Live Slides Broadcast (generic)
// ============================================================================

#[tauri::command]
async fn broadcast_live_slides_message(message: String) -> Result<(), String> {
    let state = SERVER_STATE.clone();

    // If the server isn't running, there's nowhere to broadcast to.
    // We return an error so callers can decide whether to surface it or ignore it.
    if !*state.running.read().await {
        return Err("Live Slides server is not running".to_string());
    }

    state
        .broadcast_tx
        .send(message)
        .map_err(|e| format!("Failed to broadcast: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn update_sync_playlists(playlists: serde_json::Value) -> Result<(), String> {
    let state = SYNC_SERVER_STATE.clone();
    *state.playlists.write().await = Some(playlists);
    Ok(())
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
            list_native_audio_input_devices,
            assemblyai_create_realtime_token,
            write_text_to_file,
            start_live_slides_server,
            stop_live_slides_server,
            create_live_slide_session,
            delete_live_slide_session,
            get_live_slide_sessions,
            get_live_slides_server_info,
            get_local_ip,
            update_schedule,
            update_timer_state,
            // Network Sync commands
            start_sync_server,
            stop_sync_server,
            get_sync_server_info,
            broadcast_sync_message,
            update_sync_playlists,
            // Live Slides generic broadcast
            broadcast_live_slides_message
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

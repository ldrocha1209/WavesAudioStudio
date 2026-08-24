use std::{
    fs,
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
};

use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AppSettings {
    output_folder: String,
    default_format: String,
    default_quality: String,
    hardware_acceleration: String,
    appearance: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            output_folder: "~/Music/Waves".into(),
            default_format: "WAV".into(),
            default_quality: "Highest".into(),
            hardware_acceleration: "Automatic".into(),
            appearance: "Shadow".into(),
        }
    }
}

#[derive(Default)]
struct EngineState {
    child: Mutex<Option<Child>>,
    status: Mutex<String>,
}

#[tauri::command]
fn engine_status(state: State<'_, EngineState>) -> Result<String, String> {
    state
        .status
        .lock()
        .map(|status| status.clone())
        .map_err(|_| "engine status lock poisoned".to_string())
}

#[tauri::command]
fn start_engine(app: AppHandle) -> Result<String, String> {
    start_engine_impl(&app)
}

fn start_engine_impl(app: &AppHandle) -> Result<String, String> {
    let state = app.state::<EngineState>();
    let mut child_slot = state
        .child
        .lock()
        .map_err(|_| "engine child lock poisoned".to_string())?;
    if child_slot.is_some() {
        return Ok("running".to_string());
    }

    let packaged_engine = app
        .path()
        .resource_dir()
        .map_err(|error| format!("unable to locate app resources: {error}"))?
        .join("waves-engine-onedir/waves-engine");
    let development_engine = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../engine/dist/waves-engine-onedir/waves-engine");
    let engine = if packaged_engine.is_file() {
        packaged_engine
    } else {
        development_engine
    };
    let mut child = Command::new(&engine)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("unable to start {}: {error}", engine.display()))?;

    child
        .stdin
        .as_mut()
        .ok_or_else(|| "engine stdin was not captured".to_string())?
        .write_all(b"{\"protocol\":1,\"type\":\"ping\",\"requestId\":\"tauri-start\"}\n")
        .map_err(|error| format!("unable to write engine handshake: {error}"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "engine stdout was not captured".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "engine stderr was not captured".to_string())?;
    *child_slot = Some(child);
    *state
        .status
        .lock()
        .map_err(|_| "engine status lock poisoned".to_string())? = "starting".to_string();

    let stdout_app = app.clone();
    thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if line.contains("engine_ready") || line.contains("pong") {
                if let Ok(mut status) = stdout_app.state::<EngineState>().status.lock() {
                    *status = "connected".to_string();
                }
            }
            let _ = stdout_app.emit("waves://engine", line);
        }

        let exit_code = stdout_app
            .state::<EngineState>()
            .child
            .lock()
            .ok()
            .and_then(|mut child_slot| child_slot.take())
            .and_then(|mut child| child.wait().ok())
            .and_then(|status| status.code());
        if let Ok(mut status) = stdout_app.state::<EngineState>().status.lock() {
            *status = format!("stopped ({exit_code:?})");
        }
        let _ = stdout_app.emit("waves://engine-stopped", exit_code);
    });

    let stderr_app = app.clone();
    thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            let _ = stderr_app.emit("waves://engine-diagnostic", line);
        }
    });

    Ok("starting".to_string())
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("unable to locate settings directory: {error}"))?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("unable to create settings directory: {error}"))?;
    Ok(directory.join("settings.json"))
}

#[tauri::command]
fn get_settings(app: AppHandle) -> AppSettings {
    settings_path(&app)
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|value| serde_json::from_str(&value).ok())
        .unwrap_or_default()
}

#[tauri::command]
fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = settings_path(&app)?;
    let temporary = path.with_extension("json.tmp");
    let contents = serde_json::to_vec_pretty(&settings).map_err(|error| error.to_string())?;
    fs::write(&temporary, contents)
        .map_err(|error| format!("unable to write settings: {error}"))?;
    fs::rename(&temporary, &path).map_err(|error| format!("unable to publish settings: {error}"))
}

#[tauri::command]
fn send_engine(message: String, state: State<'_, EngineState>) -> Result<(), String> {
    if message.len() > 64 * 1024 || !message.ends_with('\n') {
        return Err("invalid engine frame".to_string());
    }
    let mut child_slot = state
        .child
        .lock()
        .map_err(|_| "engine child lock poisoned".to_string())?;
    let child = child_slot
        .as_mut()
        .ok_or_else(|| "engine is not running".to_string())?;
    child
        .stdin
        .as_mut()
        .ok_or_else(|| "engine stdin is unavailable".to_string())?
        .write_all(message.as_bytes())
        .map_err(|error| format!("unable to write engine message: {error}"))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(EngineState::default())
        .setup(|app| {
            if let Err(error) = start_engine_impl(app.handle()) {
                eprintln!("Phase 0 engine startup failed: {error}");
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                let state = window.app_handle().state::<EngineState>();
                if let Ok(mut child_slot) = state.child.lock() {
                    if let Some(child) = child_slot.as_mut() {
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                    *child_slot = None;
                };
            }
        })
        .invoke_handler(tauri::generate_handler![
            engine_status,
            start_engine,
            send_engine,
            get_settings,
            save_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running the Waves Phase 0 desktop proof");
}

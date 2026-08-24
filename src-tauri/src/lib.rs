use std::{
    collections::HashMap,
    fs,
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
    thread,
};

use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_dialog::DialogExt;

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

#[derive(Default)]
struct GrantState {
    sources: Mutex<HashMap<String, PathBuf>>,
    destinations: Mutex<HashMap<String, PathBuf>>,
    next_id: AtomicU64,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PathGrant {
    grant_id: String,
    display_path: String,
}

fn new_grant_id(grants: &GrantState) -> String {
    format!("grant-{}", grants.next_id.fetch_add(1, Ordering::Relaxed))
}

fn register_source(path: PathBuf, grants: &GrantState) -> Result<PathGrant, String> {
    let path = path
        .canonicalize()
        .map_err(|_| "source is unavailable".to_string())?;
    let allowed = ["mp3", "wav", "flac", "aiff", "aif", "m4a"];
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !path.is_file() || !allowed.contains(&extension.as_str()) {
        return Err("unsupported source".to_string());
    }
    let grant_id = new_grant_id(grants);
    grants
        .sources
        .lock()
        .map_err(|_| "source grant lock poisoned".to_string())?
        .insert(grant_id.clone(), path.clone());
    Ok(PathGrant {
        grant_id,
        display_path: path.display().to_string(),
    })
}

#[tauri::command]
fn choose_source(
    app: AppHandle,
    grants: State<'_, GrantState>,
) -> Result<Option<PathGrant>, String> {
    let selected = app
        .dialog()
        .file()
        .add_filter("Audio", &["mp3", "wav", "flac", "aiff", "aif", "m4a"])
        .blocking_pick_file();
    selected
        .map(|path| {
            path.into_path()
                .map_err(|_| "selected source is not a filesystem path".to_string())
                .and_then(|path| register_source(path, &grants))
        })
        .transpose()
}

#[tauri::command]
fn register_dropped_source(
    path: String,
    grants: State<'_, GrantState>,
) -> Result<PathGrant, String> {
    register_source(PathBuf::from(path), &grants)
}

#[tauri::command]
fn choose_destination(
    app: AppHandle,
    grants: State<'_, GrantState>,
) -> Result<Option<PathGrant>, String> {
    let Some(selected) = app.dialog().file().blocking_pick_folder() else {
        return Ok(None);
    };
    let path = selected
        .into_path()
        .map_err(|_| "selected destination is not a filesystem path".to_string())?;
    let path = path
        .canonicalize()
        .map_err(|_| "destination is unavailable".to_string())?;
    let grant_id = new_grant_id(&grants);
    grants
        .destinations
        .lock()
        .map_err(|_| "destination grant lock poisoned".to_string())?
        .insert(grant_id.clone(), path.clone());
    Ok(Some(PathGrant {
        grant_id,
        display_path: path.display().to_string(),
    }))
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
    let mut command = Command::new(&engine);
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    let mut child = command
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

fn terminate_engine(child: &mut Child) {
    #[cfg(unix)]
    unsafe {
        libc::kill(-(child.id() as i32), libc::SIGTERM);
    }
    #[cfg(not(unix))]
    let _ = child.kill();
    for _ in 0..60 {
        if matches!(child.try_wait(), Ok(Some(_))) {
            return;
        }
        std::thread::sleep(std::time::Duration::from_millis(50));
    }
    #[cfg(unix)]
    unsafe {
        libc::kill(-(child.id() as i32), libc::SIGKILL);
    }
    #[cfg(not(unix))]
    let _ = child.kill();
    let _ = child.wait();
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
fn send_engine(
    message: String,
    app: AppHandle,
    state: State<'_, EngineState>,
    grants: State<'_, GrantState>,
) -> Result<(), String> {
    if message.len() > 64 * 1024 || !message.ends_with('\n') {
        return Err("invalid engine frame".to_string());
    }
    let mut frame: serde_json::Value =
        serde_json::from_str(message.trim_end()).map_err(|_| "invalid engine JSON".to_string())?;
    let message_type = frame
        .get("type")
        .and_then(|value| value.as_str())
        .ok_or_else(|| "missing engine message type".to_string())?
        .to_string();
    if ![
        "ping",
        "inspect_file",
        "inspect_url",
        "start_job",
        "cancel",
        "job_snapshot",
        "capabilities",
        "shutdown",
    ]
    .contains(&message_type.as_str())
    {
        return Err("engine message type is not allowed".to_string());
    }
    if message_type == "inspect_file" {
        let grant_id = frame
            .pointer("/payload/grantId")
            .and_then(|value| value.as_str())
            .ok_or_else(|| "source grant required".to_string())?;
        let path = grants
            .sources
            .lock()
            .map_err(|_| "source grant lock poisoned".to_string())?
            .get(grant_id)
            .cloned()
            .ok_or_else(|| "source grant is invalid".to_string())?;
        frame["payload"]["path"] = serde_json::Value::String(path.display().to_string());
    }
    if message_type == "start_job" {
        if frame
            .pointer("/payload/track/sourceKind")
            .and_then(|value| value.as_str())
            == Some("file")
        {
            let grant_id = frame
                .pointer("/payload/track/sourceGrant")
                .and_then(|value| value.as_str())
                .ok_or_else(|| "source grant required".to_string())?;
            let path = grants
                .sources
                .lock()
                .map_err(|_| "source grant lock poisoned".to_string())?
                .get(grant_id)
                .cloned()
                .ok_or_else(|| "source grant is invalid".to_string())?;
            frame["payload"]["track"]["sourcePath"] =
                serde_json::Value::String(path.display().to_string());
        }
        let destination = if let Some(grant_id) = frame
            .pointer("/payload/export/destinationGrant")
            .and_then(|value| value.as_str())
        {
            grants
                .destinations
                .lock()
                .map_err(|_| "destination grant lock poisoned".to_string())?
                .get(grant_id)
                .cloned()
                .ok_or_else(|| "destination grant is invalid".to_string())?
        } else if frame
            .pointer("/payload/export/location")
            .and_then(|value| value.as_str())
            == Some("~/Music/Waves")
        {
            app.path()
                .audio_dir()
                .map_err(|error| error.to_string())?
                .join("Waves")
        } else {
            return Err("destination grant required".to_string());
        };
        frame["payload"]["export"]["location"] =
            serde_json::Value::String(destination.display().to_string());
    }
    let encoded = serde_json::to_string(&frame).map_err(|error| error.to_string())? + "\n";
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
        .write_all(encoded.as_bytes())
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
        .manage(GrantState::default())
        .setup(|app| {
            if let Err(error) = start_engine_impl(app.handle()) {
                eprintln!("Waves engine startup failed: {error}");
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                let state = window.app_handle().state::<EngineState>();
                if let Ok(mut child_slot) = state.child.lock() {
                    if let Some(child) = child_slot.as_mut() {
                        terminate_engine(child);
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
            save_settings,
            choose_source,
            choose_destination,
            register_dropped_source
        ])
        .run(tauri::generate_context!())
        .expect("error while running Waves");
}

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::AppHandle;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub platform: String,
    pub arch: String,
    pub memory_used_mb: f64,
    pub total_memory_mb: f64,
    pub cpu_count: usize,
    pub is_offline: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileSaveResult {
    pub success: bool,
    pub path: String,
    pub timestamp: String,
}

#[derive(Default)]
pub struct AppState {
    pub last_opened_path: Mutex<Option<String>>,
}

/// Helper function to resolve the local app data / cache directory for offline autosaves
fn get_autosave_dir() -> Result<PathBuf, String> {
    let mut base = dirs::data_local_dir()
        .or_else(dirs::data_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    base.push("SimpleOfficeSuite");
    base.push("autosaves");

    if !base.exists() {
        fs::create_dir_all(&base).map_err(|e| format!("Failed to create autosave directory: {}", e))?;
    }
    Ok(base)
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("File does not exist: {}", path));
    }
    fs::read_to_string(p).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<FileSaveResult, String> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directories: {}", e))?;
        }
    }
    fs::write(p, contents).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(FileSaveResult {
        success: true,
        path,
        timestamp: chrono::Local::now().to_rfc3339(),
    })
}

#[tauri::command]
fn auto_save_snapshot(module: String, document_id: String, payload: String) -> Result<String, String> {
    let mut dir = get_autosave_dir()?;
    let safe_id = document_id.replace(|c: char| !c.is_alphanumeric() && c != '-', "_");
    dir.push(format!("{}_{}.json", module, safe_id));

    fs::write(&dir, payload)
        .map_err(|e| format!("Autosave snapshot failed: {}", e))?;

    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
fn read_auto_save_snapshot(module: String, document_id: String) -> Result<Option<String>, String> {
    let mut dir = get_autosave_dir()?;
    let safe_id = document_id.replace(|c: char| !c.is_alphanumeric() && c != '-', "_");
    dir.push(format!("{}_{}.json", module, safe_id));

    if !dir.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&dir)
        .map_err(|e| format!("Failed to read autosave snapshot: {}", e))?;
    Ok(Some(content))
}

#[tauri::command]
fn get_system_metrics() -> Result<SystemMetrics, String> {
    let mut sys = sysinfo::System::new_all();
    sys.refresh_all();

    let memory_used_mb = sys.used_memory() as f64 / 1024.0 / 1024.0;
    let total_memory_mb = sys.total_memory() as f64 / 1024.0 / 1024.0;
    let cpu_count = sys.cpus().len();

    Ok(SystemMetrics {
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        memory_used_mb: (memory_used_mb * 10.0).round() / 10.0,
        total_memory_mb: (total_memory_mb * 10.0).round() / 10.0,
        cpu_count,
        is_offline: true, // SOS guarantees 100% offline runtime
    })
}

#[tauri::command]
async fn open_native_file_dialog(
    app: AppHandle,
    title: Option<String>,
    filters: Vec<FileFilter>,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let mut builder = app.dialog().file();
    if let Some(t) = title {
        builder = builder.set_title(t);
    }

    for f in filters {
        let exts: Vec<&str> = f.extensions.iter().map(|s| s.as_str()).collect();
        builder = builder.add_filter(f.name, &exts);
    }

    let file_path = builder.blocking_pick_file();
    Ok(file_path.map(|p| p.to_string()))
}

#[tauri::command]
async fn save_native_file_dialog(
    app: AppHandle,
    title: Option<String>,
    default_name: Option<String>,
    filters: Vec<FileFilter>,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let mut builder = app.dialog().file();
    if let Some(t) = title {
        builder = builder.set_title(t);
    }
    if let Some(name) = default_name {
        builder = builder.set_file_name(name);
    }

    for f in filters {
        let exts: Vec<&str> = f.extensions.iter().map(|s| s.as_str()).collect();
        builder = builder.add_filter(f.name, &exts);
    }

    let file_path = builder.blocking_save_file();
    Ok(file_path.map(|p| p.to_string()))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            auto_save_snapshot,
            read_auto_save_snapshot,
            get_system_metrics,
            open_native_file_dialog,
            save_native_file_dialog
        ])
        .run(tauri::generate_context!())
        .expect("error while running Simple Office Suite application");
}

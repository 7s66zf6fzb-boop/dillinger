// Dillinger desktop shell: runs the local Next.js dev server and shows it in its own window.
// Markdown files opened from Finder are queued here and handed to the editor page, which
// can save them back to disk.
use std::collections::HashSet;
use std::fs::File;
use std::net::{SocketAddr, TcpStream};
use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use tauri::webview::NewWindowResponse;
use tauri::{AppHandle, Manager, RunEvent, State, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;

const PORT: u16 = 3000; // must match NEXT_PUBLIC_BASE_URL so OAuth callbacks work
const START_TIMEOUT_SECS: u64 = 90;
// WKWebView's default user agent lacks the Safari token, and some OAuth providers (Google) reject it.
const USER_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

/// The dev server, when this app started it (None if one was already running).
struct Server(Mutex<Option<Child>>);

/// A file the user opened from Finder (or `open -a Dillinger file.md`).
#[derive(Clone, serde::Serialize)]
struct OpenedFile {
    path: String,
    name: String,
    content: String,
}

#[derive(Default)]
struct OpenedFiles {
    /// Opened but not yet taken by the editor page.
    pending: Mutex<Vec<OpenedFile>>,
    /// Every path the user opened this session; only these may be written by save_file.
    allowed: Mutex<HashSet<PathBuf>>,
}

/// Called by the editor page when it is ready, and again whenever it is told files arrived.
#[tauri::command]
fn take_opened_files(files: State<OpenedFiles>) -> Vec<OpenedFile> {
    std::mem::take(&mut *files.pending.lock().unwrap())
}

#[tauri::command]
fn save_file(path: String, content: String, files: State<OpenedFiles>) -> Result<(), String> {
    let path = PathBuf::from(path);
    if !files.allowed.lock().unwrap().contains(&path) {
        return Err("This document was not opened from a file in this session.".into());
    }
    write_atomic(&path, &content)
}

/// Where Save As put the file.
#[derive(serde::Serialize)]
struct SavedFile {
    path: String,
    name: String,
}

/// Shows the macOS save panel and writes the document there. None if the user cancelled.
/// Async so the panel does not block the main thread it runs on.
#[tauri::command]
async fn save_file_as(
    app: AppHandle,
    window: tauri::WebviewWindow,
    content: String,
    suggested_name: String,
    current_path: Option<String>,
) -> Result<Option<SavedFile>, String> {
    let dir = current_path
        .as_deref()
        .and_then(|p| Path::new(p).parent().map(Path::to_path_buf))
        .or_else(|| std::env::var("HOME").ok().map(|h| PathBuf::from(h).join("Documents")));
    let mut dialog = app
        .dialog()
        .file()
        .set_parent(&window)
        .set_title("Save As")
        .set_file_name(suggested_name)
        .add_filter("Markdown", &["md", "markdown", "txt"]);
    if let Some(dir) = dir {
        dialog = dialog.set_directory(dir);
    }
    let Some(chosen) = dialog.blocking_save_file() else {
        return Ok(None);
    };
    let path = chosen.into_path().map_err(|e| e.to_string())?;
    write_atomic(&path, &content)?;
    app.state::<OpenedFiles>().allowed.lock().unwrap().insert(path.clone());
    Ok(Some(SavedFile {
        name: path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default(),
        path: path.to_string_lossy().into_owned(),
    }))
}

/// Opens the macOS print dialog for the page; its print stylesheet limits it to the document.
#[tauri::command]
fn print_page(window: tauri::WebviewWindow) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}

fn write_atomic(path: &Path, content: &str) -> Result<(), String> {
    // Write beside the file, then rename over it, so a failed write never truncates it.
    let dir = path.parent().ok_or("Invalid file path")?;
    let name = path.file_name().ok_or("Invalid file path")?.to_string_lossy();
    let tmp = dir.join(format!(".{name}.dillinger-save"));
    std::fs::write(&tmp, content.as_bytes())
        .and_then(|_| std::fs::rename(&tmp, &path))
        .map_err(|e| {
            let _ = std::fs::remove_file(&tmp);
            format!("Could not save {}: {e}", path.display())
        })
}

fn open_files(handle: &AppHandle, urls: Vec<Url>) {
    let state = handle.state::<OpenedFiles>();
    let mut added = false;
    for url in urls {
        let Ok(path) = url.to_file_path() else { continue };
        let bytes = match std::fs::read(&path) {
            Ok(b) => b,
            Err(e) => {
                alert(&format!("Could not open {}: {e}", path.display()));
                continue;
            }
        };
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| "Untitled.md".into());
        state.allowed.lock().unwrap().insert(path.clone());
        state.pending.lock().unwrap().push(OpenedFile {
            path: path.to_string_lossy().into_owned(),
            name,
            content: String::from_utf8_lossy(&bytes).into_owned(),
        });
        added = true;
    }
    if !added {
        return;
    }
    if let Some(window) = handle.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
        // Harmless if the editor page is not loaded yet: it takes pending files on startup.
        let _ = window.eval("window.dispatchEvent(new Event('dillinger:files-opened'))");
    }
}

fn log_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
    PathBuf::from(home).join("Library/Logs/Dillinger.log")
}

fn is_up() -> bool {
    let addr = SocketAddr::from(([127, 0, 0, 1], PORT));
    TcpStream::connect_timeout(&addr, Duration::from_secs(1)).is_ok()
}

/// Walk up from the app's location to the folder whose package.json is named "dillinger".
fn find_project() -> Option<PathBuf> {
    if let Ok(dir) = std::env::var("DILLINGER_PROJECT") {
        return Some(PathBuf::from(dir));
    }
    let exe = std::env::current_exe().ok()?;
    let mut dir: Option<&Path> = exe.parent();
    while let Some(d) = dir {
        if let Ok(text) = std::fs::read_to_string(d.join("package.json")) {
            if text.contains("\"name\": \"dillinger\"") {
                return Some(d.to_path_buf());
            }
        }
        dir = d.parent();
    }
    None
}

fn start_server(project: &Path) -> std::io::Result<Child> {
    let log = File::create(log_path())?;
    let path = format!(
        "/opt/homebrew/bin:/usr/local/bin:{}",
        std::env::var("PATH").unwrap_or_else(|_| "/usr/bin:/bin".into())
    );
    Command::new("npm")
        .args(["run", "dev"])
        .current_dir(project)
        .env("PATH", path)
        .stdin(Stdio::null())
        .stdout(log.try_clone()?)
        .stderr(log)
        .process_group(0) // own group, so quitting can stop npm and next together
        .spawn()
}

fn stop_server(child: &mut Child) {
    if let Ok(None) = child.try_wait() {
        let _ = Command::new("kill")
            .args(["-TERM", &format!("-{}", child.id())])
            .status();
        let _ = child.wait();
    }
}

fn alert(message: &str) {
    let script = format!(
        "display alert \"Dillinger\" message \"{}\"",
        message.replace('\\', "\\\\").replace('"', "\\\"")
    );
    let _ = Command::new("osascript").args(["-e", &script]).status();
}

fn main() {
    let app = tauri::Builder::default()
        .manage(Server(Mutex::new(None)))
        .manage(OpenedFiles::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            take_opened_files,
            save_file,
            save_file_as,
            print_page
        ])
        .setup(|app| {
            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Dillinger")
                .inner_size(1400.0, 900.0)
                .min_inner_size(700.0, 500.0)
                .user_agent(USER_AGENT)
                .zoom_hotkeys_enabled(true)
                // Links that ask for a new window open in the default browser;
                // in-window navigation (OAuth sign-in) stays in the app.
                .on_new_window(|url, _features| {
                    if matches!(url.scheme(), "http" | "https") {
                        let _ = Command::new("open").arg(url.as_str()).status();
                    }
                    NewWindowResponse::Deny
                })
                .build()?;

            let handle = app.handle().clone();
            std::thread::spawn(move || {
                if !is_up() {
                    let Some(project) = find_project() else {
                        alert("Could not find the Dillinger project folder. Keep Dillinger.app inside the project folder.");
                        handle.exit(1);
                        return;
                    };
                    match start_server(&project) {
                        Ok(child) => *handle.state::<Server>().0.lock().unwrap() = Some(child),
                        Err(e) => {
                            alert(&format!("Could not run npm ({e}). Is Node.js installed?"));
                            handle.exit(1);
                            return;
                        }
                    }
                    let mut ready = false;
                    for _ in 0..START_TIMEOUT_SECS {
                        if is_up() {
                            ready = true;
                            break;
                        }
                        let exited = handle
                            .state::<Server>()
                            .0
                            .lock()
                            .unwrap()
                            .as_mut()
                            .map_or(true, |c| !matches!(c.try_wait(), Ok(None)));
                        if exited {
                            break;
                        }
                        std::thread::sleep(Duration::from_secs(1));
                    }
                    if !ready {
                        alert(&format!(
                            "The editor did not start. Details are in {}",
                            log_path().display()
                        ));
                        handle.exit(1);
                        return;
                    }
                }
                let url = Url::parse(&format!("http://localhost:{PORT}")).unwrap();
                let _ = window.navigate(url);
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build Dillinger");

    app.run(|handle, event| match event {
        RunEvent::Opened { urls } => open_files(handle, urls),
        RunEvent::Exit => {
            if let Some(mut child) = handle.state::<Server>().0.lock().unwrap().take() {
                stop_server(&mut child);
            }
        }
        _ => {}
    });
}

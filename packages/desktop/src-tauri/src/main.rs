// Dillinger desktop shell: runs a production build of the local Next.js app and shows it in its
// own window, rebuilding first when the source has changed since the last build.
// Markdown files opened from Finder are queued here and handed to the editor page, which
// can save them back to disk.
use std::collections::hash_map::DefaultHasher;
use std::collections::HashSet;
use std::hash::{Hash, Hasher};
use std::fs::{File, OpenOptions};
use std::net::{SocketAddr, TcpStream};
use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime};

use tauri::webview::NewWindowResponse;
use tauri::{AppHandle, Manager, RunEvent, State, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_dialog::DialogExt;

const PORT: u16 = 3000; // must match NEXT_PUBLIC_BASE_URL so OAuth callbacks work
const START_TIMEOUT: Duration = Duration::from_secs(90);
const BUILD_TIMEOUT: Duration = Duration::from_secs(600);
const POLL_INTERVAL: Duration = Duration::from_millis(100);
// Kept apart from .next so the desktop build never clashes with `npm run dev`.
const DIST_DIR: &str = ".next-desktop";
// Written beside the build: the inputs it was made from, and the server this app started.
const INPUTS_FILE: &str = "desktop-inputs";
const PID_FILE: &str = "desktop-server.pid";
// What the production build is made from; adding, removing or editing a file in any of these
// triggers a rebuild (dotfiles and the CLAUDE.md notes in these folders do not count).
const BUILD_INPUTS: &[&str] = &[
    "app", "components", "hooks", "lib", "stores", "types", "public",
    "package.json", "package-lock.json", "next.config.mjs", "tailwind.config.ts",
    "postcss.config.mjs", "tsconfig.json",
    ".env", ".env.local", ".env.production", ".env.production.local",
];
// WKWebView's default user agent lacks the Safari token, and some OAuth providers (Google) reject it.
const USER_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

/// The build or server process this app started (None if a server was already running), and
/// whether the app is quitting. One lock, so no process can start after quitting has begun.
#[derive(Default)]
struct ServerState {
    child: Option<Child>,
    quitting: bool,
}

#[derive(Default)]
struct Server(Mutex<ServerState>);

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

/// Opens the Markdown format tips in their own window, or brings that window forward.
/// Async: creating a window from a synchronous command can deadlock.
#[tauri::command]
async fn open_tips_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("tips") {
        let _ = window.unminimize();
        let _ = window.show();
        return window.set_focus().map_err(|e| e.to_string());
    }
    let url = Url::parse(&format!("http://localhost:{PORT}/tips")).map_err(|e| e.to_string())?;
    WebviewWindowBuilder::new(&app, "tips", WebviewUrl::External(url))
        .title("Markdown Format Tips")
        .inner_size(640.0, 860.0)
        .min_inner_size(360.0, 400.0)
        .user_agent(USER_AGENT)
        .on_new_window(|url, _features| open_in_browser(&url))
        .build()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Links that ask for a new window open in the default browser.
fn open_in_browser<R: tauri::Runtime>(url: &Url) -> NewWindowResponse<R> {
    if matches!(url.scheme(), "http" | "https") {
        let _ = Command::new("open").arg(url.as_str()).status();
    }
    NewWindowResponse::Deny
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
        let _ = window.show(); // it may be hidden after its window was closed
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

/// Adds the build inputs under `path` (a file, or a folder walked without following links).
fn collect_inputs(path: &Path, out: &mut Vec<(PathBuf, SystemTime)>) {
    let Ok(meta) = std::fs::symlink_metadata(path) else { return };
    if meta.is_dir() {
        let Ok(entries) = std::fs::read_dir(path) else { return };
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if name.starts_with('.') || name == "CLAUDE.md" {
                continue;
            }
            collect_inputs(&entry.path(), out);
        }
    } else if let Ok(modified) = std::fs::metadata(path).and_then(|m| m.modified()) {
        // A link to a file counts as that file; a link to a folder is not walked (no loops).
        if std::fs::metadata(path).map_or(false, |m| m.is_file()) {
            out.push((path.to_path_buf(), modified));
        }
    }
}

/// Which files the build inputs are and when each last changed, as one comparable line.
fn inputs_fingerprint(project: &Path) -> String {
    let mut inputs = Vec::new();
    for input in BUILD_INPUTS {
        collect_inputs(&project.join(input), &mut inputs);
    }
    inputs.sort();
    // Every path with its own time, so an older copy put back in place (cp -p) still counts.
    let mut hasher = DefaultHasher::new();
    for (path, modified) in &inputs {
        path.hash(&mut hasher);
        modified.duration_since(SystemTime::UNIX_EPOCH).map_or(0, |d| d.as_nanos()).hash(&mut hasher);
    }
    format!("{} {:x}", inputs.len(), hasher.finish())
}

/// True when there is no production build yet, or its inputs changed since it was made.
fn build_is_stale(project: &Path, fingerprint: &str) -> bool {
    let dist = project.join(DIST_DIR);
    !dist.join("BUILD_ID").is_file()
        || std::fs::read_to_string(dist.join(INPUTS_FILE)).map_or(true, |saved| saved != fingerprint)
}

/// Runs the Next.js CLI with Node directly (skipping npm saves a few hundred milliseconds),
/// unless the app is already quitting. The child is tracked so quitting stops it, and its
/// process group is recorded in `pid_file` (under the same lock, so quitting cannot miss it).
fn spawn_next(handle: &AppHandle, project: &Path, args: &[&str], log: &File, pid_file: Option<&Path>) -> Result<(), String> {
    let server = handle.state::<Server>();
    let mut state = server.0.lock().unwrap();
    if state.quitting {
        return Err("Dillinger is quitting.".into());
    }
    let path = format!(
        "/opt/homebrew/bin:/usr/local/bin:{}",
        std::env::var("PATH").unwrap_or_else(|_| "/usr/bin:/bin".into())
    );
    let child = Command::new("node")
        .arg("node_modules/next/dist/bin/next")
        .args(args)
        .current_dir(project)
        .env("PATH", path)
        .env("NEXT_DIST_DIR", DIST_DIR)
        .env("DILLINGER_DESKTOP", "1") // served over http://localhost (see lib/cookies.ts)
        .stdin(Stdio::null())
        .stdout(log.try_clone().map_err(|e| e.to_string())?)
        .stderr(log.try_clone().map_err(|e| e.to_string())?)
        .process_group(0) // own group, so quitting stops next and its workers together
        .spawn()
        .map_err(|e| format!("Could not run Node.js ({e}). Is it installed?"))?;
    if let Some(pid_file) = pid_file {
        let _ = std::fs::write(pid_file, child.id().to_string());
    }
    state.child = Some(child);
    Ok(())
}

/// The tracked process's exit status: None while it runs, Some(false) if it is gone.
fn child_finished(handle: &AppHandle) -> Option<bool> {
    let server = handle.state::<Server>();
    let mut state = server.0.lock().unwrap();
    match state.child.as_mut().map(|c| c.try_wait()) {
        Some(Ok(None)) => None,
        Some(Ok(Some(status))) => Some(status.success()),
        _ => Some(false), // taken by quitting, or unreadable
    }
}

fn is_quitting(handle: &AppHandle) -> bool {
    let server = handle.state::<Server>();
    let quitting = server.0.lock().unwrap().quitting;
    quitting
}

/// A server this app started before a crash or force quit is still holding the port. Stop it,
/// so this launch serves the current build instead of an old one. A server someone else
/// started (`npm run dev`) has no pid file and is left alone.
fn reclaim_orphaned_server(project: &Path) {
    let pid_file = project.join(DIST_DIR).join(PID_FILE);
    let Ok(pid) = std::fs::read_to_string(&pid_file) else { return };
    let pid = pid.trim();
    // Ours only if it is a Next.js process (it renames itself "next-server") running in this
    // project folder, so a reused pid is never someone else's process.
    let output = |cmd: &str, args: &[&str]| {
        Command::new(cmd).args(args).output().map(|o| String::from_utf8_lossy(&o.stdout).into_owned()).unwrap_or_default()
    };
    let is_next = output("ps", &["-o", "command=", "-p", pid]).contains("next");
    let cwd = output("lsof", &["-a", "-p", pid, "-d", "cwd", "-Fn"]);
    let project = std::fs::canonicalize(project).unwrap_or_else(|_| project.to_path_buf());
    let in_project = cwd.lines().any(|line| line.strip_prefix('n').map(Path::new) == Some(project.as_path()));
    let ours = is_next && in_project;
    if ours {
        for signal in ["-TERM", "-KILL"] {
            let _ = Command::new("kill").args([signal, &format!("-{pid}")]).status();
            let deadline = Instant::now() + Duration::from_secs(5);
            while is_up() && Instant::now() < deadline {
                std::thread::sleep(POLL_INTERVAL);
            }
            if !is_up() {
                break;
            }
        }
    }
    let _ = std::fs::remove_file(pid_file);
}

/// Builds if needed, then starts the production server and waits until it answers.
fn launch(handle: &AppHandle, window: &tauri::WebviewWindow, project: &Path) -> Result<(), String> {
    let log = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(log_path())
        .map_err(|e| format!("Could not write {}: {e}", log_path().display()))?;
    let failed = || format!("The editor did not start. Details are in {}", log_path().display());

    let fingerprint = inputs_fingerprint(project);
    if build_is_stale(project, &fingerprint) {
        let _ = window.eval("document.body.textContent = 'Updating Dillinger after a code change… (about 20 seconds)'");
        spawn_next(handle, project, &["build"], &log, None)?;
        let deadline = Instant::now() + BUILD_TIMEOUT;
        let built = loop {
            if let Some(success) = child_finished(handle) {
                break success;
            }
            if Instant::now() > deadline {
                break false;
            }
            std::thread::sleep(POLL_INTERVAL);
        };
        let server = handle.state::<Server>();
        let finished = server.0.lock().unwrap().child.take();
        if let Some(mut child) = finished {
            stop_server(&mut child); // no-op once it has exited; stops a build that timed out
        }
        if !built {
            return Err(failed());
        }
        let _ = std::fs::write(project.join(DIST_DIR).join(INPUTS_FILE), &fingerprint);
    }

    let port = PORT.to_string();
    spawn_next(handle, project, &["start", "-p", &port], &log, Some(&project.join(DIST_DIR).join(PID_FILE)))?;
    let deadline = Instant::now() + START_TIMEOUT;
    while !is_up() {
        if child_finished(handle).is_some() || Instant::now() > deadline {
            return Err(failed());
        }
        std::thread::sleep(POLL_INTERVAL);
    }
    Ok(())
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
        .manage(Server::default())
        .manage(OpenedFiles::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            take_opened_files,
            save_file,
            save_file_as,
            print_page,
            open_tips_window
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
                .on_new_window(|url, _features| open_in_browser(&url))
                .build()?;

            // Closing the window hides it; the app keeps running (with its Dock dot) until quit.
            let hidden = window.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = hidden.hide();
                }
            });

            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let project = find_project();
                if let Some(project) = &project {
                    reclaim_orphaned_server(project);
                }
                // A server already on the port (say, `npm run dev`) is used as it is.
                if !is_up() {
                    let result = match &project {
                        Some(project) => launch(&handle, &window, project),
                        None => Err("Could not find the Dillinger project folder. Keep Dillinger.app inside the project folder.".into()),
                    };
                    if let Err(message) = result {
                        // Quitting stops the build or server on purpose; that is not an error.
                        if !is_quitting(&handle) {
                            alert(&message);
                            handle.exit(1);
                        }
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
        // Clicking the Dock icon brings back the editor window if it was closed (even when
        // the format tips window is still open).
        RunEvent::Reopen { .. } => {
            if let Some(window) = handle.get_webview_window("main") {
                if !window.is_visible().unwrap_or(true) {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        }
        RunEvent::Exit => {
            let server = handle.state::<Server>();
            let child = {
                let mut state = server.0.lock().unwrap();
                state.quitting = true;
                state.child.take()
            };
            if let Some(mut child) = child {
                stop_server(&mut child);
            }
            if let Some(project) = find_project() {
                let _ = std::fs::remove_file(project.join(DIST_DIR).join(PID_FILE));
            }
        }
        _ => {}
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A throwaway project folder with one source file and a finished build.
    fn project() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "dillinger-inputs-{}-{}",
            std::process::id(),
            SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_nanos()
        ));
        std::fs::create_dir_all(dir.join("app")).unwrap();
        std::fs::create_dir_all(dir.join(DIST_DIR)).unwrap();
        std::fs::write(dir.join("app/page.tsx"), "a").unwrap();
        std::fs::write(dir.join(DIST_DIR).join("BUILD_ID"), "x").unwrap();
        dir
    }

    fn built(dir: &Path) -> String {
        let fingerprint = inputs_fingerprint(dir);
        std::fs::write(dir.join(DIST_DIR).join(INPUTS_FILE), &fingerprint).unwrap();
        fingerprint
    }

    #[test]
    fn rebuilds_when_a_file_is_added_removed_or_missing_build() {
        let dir = project();
        assert!(build_is_stale(&dir, &inputs_fingerprint(&dir)), "no saved inputs yet");
        built(&dir);
        assert!(!build_is_stale(&dir, &inputs_fingerprint(&dir)));

        std::fs::write(dir.join("app/new.tsx"), "b").unwrap();
        assert!(build_is_stale(&dir, &inputs_fingerprint(&dir)), "added file");
        built(&dir);

        std::fs::remove_file(dir.join("app/new.tsx")).unwrap();
        assert!(build_is_stale(&dir, &inputs_fingerprint(&dir)), "removed file");
        built(&dir);

        std::fs::remove_file(dir.join(DIST_DIR).join("BUILD_ID")).unwrap();
        assert!(build_is_stale(&dir, &inputs_fingerprint(&dir)), "build missing");
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn rebuilds_when_a_file_changes() {
        let dir = project();
        built(&dir);
        std::thread::sleep(Duration::from_millis(20));
        std::fs::write(dir.join("app/page.tsx"), "changed").unwrap();
        assert!(build_is_stale(&dir, &inputs_fingerprint(&dir)));
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn rebuilds_when_an_older_copy_is_put_back() {
        let dir = project();
        std::fs::write(dir.join("app/newer.tsx"), "n").unwrap();
        let old = std::fs::File::options().write(true).open(dir.join("app/page.tsx")).unwrap();
        old.set_modified(SystemTime::UNIX_EPOCH + Duration::from_secs(1_000_000)).unwrap();
        built(&dir);
        // Same count, same newest file, same paths: only page.tsx's own time differs
        old.set_modified(SystemTime::UNIX_EPOCH + Duration::from_secs(2_000_000)).unwrap();
        assert!(build_is_stale(&dir, &inputs_fingerprint(&dir)));
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn ignores_notes_dotfiles_and_folder_links() {
        let dir = project();
        built(&dir);
        std::fs::write(dir.join("app/CLAUDE.md"), "notes").unwrap();
        std::fs::write(dir.join("app/.DS_Store"), "finder").unwrap();
        // A link back to its own folder would loop forever if it were followed.
        std::os::unix::fs::symlink(dir.join("app"), dir.join("app/loop")).unwrap();
        assert!(!build_is_stale(&dir, &inputs_fingerprint(&dir)));
        std::fs::remove_dir_all(dir).unwrap();
    }
}

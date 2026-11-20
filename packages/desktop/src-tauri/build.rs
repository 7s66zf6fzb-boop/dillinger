fn main() {
    // Declaring the app's commands gives them ACL permissions, so the capability in
    // capabilities/ can grant them to the editor page served from localhost.
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&["take_opened_files", "save_file"]),
        ),
    )
    .expect("failed to run tauri-build");
}

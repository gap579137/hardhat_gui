use std::process::Command;
use std::path::Path;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct HardhatStatus {
    pub installed: bool,
    pub version: Option<String>,
    pub project_detected: bool,
    pub project_path: Option<String>,
    pub network_running: bool,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn check_hardhat_status(project_path: Option<String>) -> Result<HardhatStatus, String> {
    let mut status = HardhatStatus {
        installed: false,
        version: None,
        project_detected: false,
        project_path: None,
        network_running: false,
    };

    // Check if Hardhat is installed globally
    if let Ok(output) = Command::new("npx").args(["hardhat", "--version"]).output() {
        if output.status.success() {
            status.installed = true;
            if let Ok(version_str) = String::from_utf8(output.stdout) {
                status.version = Some(version_str.trim().to_string());
            }
        }
    }

    // Check if we're in a Hardhat project or if a path was provided
    let check_path = project_path.as_deref().unwrap_or(".");
    let hardhat_config = Path::new(check_path).join("hardhat.config.js");
    let hardhat_config_ts = Path::new(check_path).join("hardhat.config.ts");
    
    if hardhat_config.exists() || hardhat_config_ts.exists() {
        status.project_detected = true;
        status.project_path = Some(check_path.to_string());
    }

    // Check if network is running by trying to connect
    status.network_running = check_network_connection().await;

    Ok(status)
}

#[tauri::command]
async fn install_hardhat() -> Result<String, String> {
    let output = Command::new("npm")
        .args(["install", "-g", "hardhat"])
        .output()
        .map_err(|e| format!("Failed to execute npm: {}", e))?;

    if output.status.success() {
        Ok("Hardhat installed successfully!".to_string())
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to install Hardhat: {}", error))
    }
}

#[tauri::command]
async fn create_hardhat_project(project_path: String) -> Result<String, String> {
    // Create directory if it doesn't exist
    std::fs::create_dir_all(&project_path)
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    // Initialize Hardhat project
    let output = Command::new("npx")
        .args(["hardhat", "init", "--yes"])
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to execute hardhat init: {}", e))?;

    if output.status.success() {
        Ok(format!("Hardhat project created successfully at {}", project_path))
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to create Hardhat project: {}", error))
    }
}

#[tauri::command]
async fn start_hardhat_network(project_path: String) -> Result<String, String> {
    // This will start the network in the background
    // Note: In a real implementation, you might want to use a more sophisticated
    // process management approach
    let _child = Command::new("npx")
        .args(["hardhat", "node"])
        .current_dir(&project_path)
        .spawn()
        .map_err(|e| format!("Failed to start Hardhat network: {}", e))?;

    Ok("Hardhat network started successfully!".to_string())
}

async fn check_network_connection() -> bool {
    // Try to make a simple HTTP request to the Hardhat network
    // This is a simplified check - in a real implementation you might want to use reqwest
    use std::net::TcpStream;
    use std::time::Duration;
    
    match TcpStream::connect_timeout(
        &"127.0.0.1:8545".parse().unwrap(),
        Duration::from_secs(2)
    ) {
        Ok(_) => true,
        Err(_) => false,
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            check_hardhat_status,
            install_hardhat,
            create_hardhat_project,
            start_hardhat_network
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

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

    // Try different approaches to create a Hardhat project non-interactively
    
    // First, try with environment variable to force non-interactive mode
    let mut cmd = Command::new("npx");
    cmd.args(["hardhat", "init"])
        .current_dir(&project_path)
        .env("CI", "true")  // This often forces non-interactive mode
        .env("HARDHAT_CREATE_JAVASCRIPT_PROJECT_WITH_DEFAULTS", "true");
    
    let output = cmd.output()
        .map_err(|e| format!("Failed to execute hardhat init: {}", e))?;

    if output.status.success() {
        Ok(format!("Hardhat project created successfully at {}", project_path))
    } else {
        let _error = String::from_utf8_lossy(&output.stderr);
        
        // If the first approach fails, try the template approach
        let template_output = Command::new("npx")
            .args(["create-hardhat"])
            .current_dir(&project_path)
            .env("CI", "true")
            .output();
            
        match template_output {
            Ok(out) if out.status.success() => {
                Ok(format!("Hardhat project created successfully at {}", project_path))
            },
            _ => {
                // Final fallback: Create a minimal project structure manually
                create_minimal_hardhat_project(&project_path)?;
                Ok(format!("Hardhat project created successfully at {} (using fallback method)", project_path))
            }
        }
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

fn create_minimal_hardhat_project(project_path: &str) -> Result<(), String> {
    use std::fs;
    use std::path::Path;

    let project_dir = Path::new(project_path);

    // Create package.json
    let package_json = r#"{
  "name": "hardhat-project",
  "version": "1.0.0",
  "description": "A Hardhat project created by Hardhat GUI",
  "scripts": {
    "test": "npx hardhat test"
  },
  "devDependencies": {
    "@nomicfoundation/hardhat-toolbox": "^5.0.0",
    "hardhat": "^2.22.0"
  }
}
"#;
    fs::write(project_dir.join("package.json"), package_json)
        .map_err(|e| format!("Failed to create package.json: {}", e))?;

    // Create hardhat.config.js
    let hardhat_config = r#"require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    }
  }
};
"#;
    fs::write(project_dir.join("hardhat.config.js"), hardhat_config)
        .map_err(|e| format!("Failed to create hardhat.config.js: {}", e))?;

    // Create contracts directory
    fs::create_dir_all(project_dir.join("contracts"))
        .map_err(|e| format!("Failed to create contracts directory: {}", e))?;

    // Create a simple contract
    let contract_content = r#"// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Lock {
    uint public unlockTime;
    address payable public owner;

    event Withdrawal(uint amount, uint when);

    constructor(uint _unlockTime) payable {
        require(
            block.timestamp < _unlockTime,
            "Unlock time should be in the future"
        );

        unlockTime = _unlockTime;
        owner = payable(msg.sender);
    }

    function withdraw() public {
        require(block.timestamp >= unlockTime, "You can't withdraw yet");
        require(msg.sender == owner, "You aren't the owner");

        emit Withdrawal(address(this).balance, block.timestamp);

        owner.transfer(address(this).balance);
    }
}
"#;
    fs::write(project_dir.join("contracts").join("Lock.sol"), contract_content)
        .map_err(|e| format!("Failed to create Lock.sol: {}", e))?;

    // Create test directory
    fs::create_dir_all(project_dir.join("test"))
        .map_err(|e| format!("Failed to create test directory: {}", e))?;

    // Create scripts directory
    fs::create_dir_all(project_dir.join("scripts"))
        .map_err(|e| format!("Failed to create scripts directory: {}", e))?;

    // Install dependencies
    let install_output = Command::new("npm")
        .args(["install"])
        .current_dir(project_path)
        .output()
        .map_err(|e| format!("Failed to install dependencies: {}", e))?;

    if !install_output.status.success() {
        let error = String::from_utf8_lossy(&install_output.stderr);
        return Err(format!("Failed to install dependencies: {}", error));
    }

    Ok(())
}

#[tauri::command]
async fn compile_contracts(project_path: String) -> Result<String, String> {
    let output = Command::new("npx")
        .args(["hardhat", "compile"])
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to execute hardhat compile: {}", e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        Ok(format!("Compilation successful!\n{}", stdout))
    } else {
        let error = String::from_utf8_lossy(&output.stderr);
        Err(format!("Compilation failed: {}", error))
    }
}

#[tauri::command]
async fn run_tests(project_path: String) -> Result<String, String> {
    let output = Command::new("npx")
        .args(["hardhat", "test"])
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to execute hardhat test: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    
    if output.status.success() {
        Ok(format!("Tests completed!\n{}", stdout))
    } else {
        Err(format!("Tests failed: {}\n{}", stderr, stdout))
    }
}

#[derive(Serialize, Deserialize)]
pub struct ContractInfo {
    pub name: String,
    pub path: String,
    pub compiled: bool,
    pub size: Option<u64>,
}

#[tauri::command]
async fn list_contracts(project_path: String) -> Result<Vec<ContractInfo>, String> {
    use std::fs;
    
    let contracts_dir = Path::new(&project_path).join("contracts");
    let mut contracts = Vec::new();
    
    if !contracts_dir.exists() {
        return Ok(contracts);
    }
    
    let entries = fs::read_dir(&contracts_dir)
        .map_err(|e| format!("Failed to read contracts directory: {}", e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();
        
        if path.extension().and_then(|s| s.to_str()) == Some("sol") {
            let name = path.file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Unknown")
                .to_string();
            
            let size = entry.metadata().ok().map(|m| m.len());
            
            // Check if contract is compiled by looking for artifacts
            // Hardhat creates artifacts at: artifacts/contracts/{filename.sol}/{ContractName}.json
            let artifacts_path = Path::new(&project_path)
                .join("artifacts")
                .join("contracts")
                .join(path.file_name().unwrap())
                .join(format!("{}.json", name));
            
            // Also check for dbg.json which is sometimes created
            let artifacts_dbg_path = Path::new(&project_path)
                .join("artifacts")
                .join("contracts")
                .join(path.file_name().unwrap())
                .join(format!("{}.dbg.json", name));
            
            let is_compiled = artifacts_path.exists() || artifacts_dbg_path.exists();
            
            // Debug logging
            println!("Contract: {}, Artifacts path: {:?}, Exists: {}", 
                name, artifacts_path, is_compiled);
            
            contracts.push(ContractInfo {
                name,
                path: path.to_string_lossy().to_string(),
                compiled: is_compiled,
                size,
            });
        }
    }
    
    Ok(contracts)
}

#[tauri::command]
async fn deploy_contracts(project_path: String) -> Result<String, String> {
    // First check if there are any ignition modules
    let ignition_dir = Path::new(&project_path).join("ignition").join("modules");
    
    if !ignition_dir.exists() {
        return Err("No Hardhat Ignition modules found. Please create deployment scripts in ignition/modules/".to_string());
    }
    
    // Look for .js or .ts files in ignition/modules
    let entries = std::fs::read_dir(&ignition_dir)
        .map_err(|e| format!("Failed to read ignition modules: {}", e))?;
    
    let mut module_file = None;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
            if ext == "js" || ext == "ts" {
                module_file = Some(path);
                break;
            }
        }
    }
    
    let module_path = module_file.ok_or("No deployment modules found in ignition/modules/")?;
    
    let output = Command::new("npx")
        .args(["hardhat", "ignition", "deploy", &module_path.to_string_lossy(), "--network", "localhost"])
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to execute deployment: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    
    if output.status.success() {
        Ok(format!("Deployment successful!\n{}", stdout))
    } else {
        Err(format!("Deployment failed: {}\n{}", stderr, stdout))
    }
}

#[tauri::command]
async fn run_hardhat_task(project_path: String, task: String, args: Vec<String>) -> Result<String, String> {
    let mut cmd_args = vec!["hardhat", &task];
    for arg in &args {
        cmd_args.push(arg);
    }
    
    let output = Command::new("npx")
        .args(&cmd_args)
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to execute hardhat task: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    
    if output.status.success() {
        Ok(stdout.to_string())
    } else {
        Err(format!("Task failed: {}\n{}", stderr, stdout))
    }
}

#[tauri::command]
async fn run_hardhat_console_command(project_path: String, command: String) -> Result<String, String> {
    // Create a temporary script file with the command
    use std::fs;
    use std::path::Path;
    
    let script_content = format!(
        r#"
const hre = require("hardhat");
const {{ ethers }} = require("hardhat");

// Make provider available globally for easier access
const provider = hre.ethers.provider;

// Custom serializer to handle BigInt and other special types
function serializeResult(obj) {{
    return JSON.stringify(obj, (key, value) => {{
        if (typeof value === 'bigint') {{
            return value.toString() + 'n';
        }}
        if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'BigNumber') {{
            return value.toString() + ' (BigNumber)';
        }}
        if (value && typeof value.address === 'string') {{
            // Handle ethers Signer objects
            return {{
                address: value.address,
                type: 'Signer'
            }};
        }}
        if (value && value._isBigNumber) {{
            return value.toString() + ' (BigNumber)';
        }}
        return value;
    }}, 2);
}}

async function main() {{
    try {{
        const result = await eval(`(async () => {{ {} }})()`);
        if (result !== undefined) {{
            if (typeof result === 'bigint') {{
                console.log(result.toString());
            }} else if (Array.isArray(result)) {{
                console.log('Array with', result.length, 'items:');
                console.log(serializeResult(result));
            }} else if (typeof result === 'object' && result !== null) {{
                console.log(serializeResult(result));
            }} else {{
                console.log(result);
            }}
        }}
    }} catch (error) {{
        console.error("Error:", error.message);
        if (error.stack) {{
            console.error("Stack:", error.stack);
        }}
        process.exit(1);
    }}
}}

main().catch((error) => {{
    console.error("Fatal error:", error.message);
    process.exit(1);
}});
"#, command
    );
    
    let temp_script = Path::new(&project_path).join("temp_console_script.js");
    fs::write(&temp_script, script_content)
        .map_err(|e| format!("Failed to create temp script: {}", e))?;
    
    let output = Command::new("npx")
        .args(["hardhat", "run", "temp_console_script.js", "--network", "localhost"])
        .current_dir(&project_path)
        .output()
        .map_err(|e| format!("Failed to execute console command: {}", e))?;
    
    // Clean up temp file
    let _ = fs::remove_file(&temp_script);
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    
    if output.status.success() {
        Ok(stdout.to_string())
    } else {
        Err(format!("Console command failed: {}\n{}", stderr, stdout))
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
            start_hardhat_network,
            compile_contracts,
            run_tests,
            list_contracts,
            deploy_contracts,
            run_hardhat_task,
            run_hardhat_console_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

# 🔨 Hardhat GUI

A modern, secure desktop application for managing and monitoring your local Hardhat blockchain development environment with **complete Hardhat lifecycle management**.

![Hardhat GUI](https://img.shields.io/badge/Hardhat-GUI-blue?style=for-the-badge)
![Tauri](https://img.shields.io/badge/Tauri-2.0-green?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge)

## ✨ Features

### 🔧 **Complete Hardhat Management**
- 🔍 **Auto-Detection** - Automatically detects if Hardhat is installed and configured
- 📦 **One-Click Installation** - Install Hardhat globally with a single click
- 🆕 **Project Creation** - Create new Hardhat projects from the GUI
- 📁 **Project Selection** - Point to existing Hardhat projects
- 🚀 **Network Management** - Start/stop Hardhat networks directly from the GUI

### 📊 **Blockchain Monitoring**
- 📡 **Real-time Network Info** - View network details, chain ID, and current block number
- 💰 **Account Management** - Display all local accounts with their ETH balances
- 🔄 **Live Updates** - Refresh blockchain data with a single click
- 📈 **Status Indicators** - Visual status for installation, project, and network

### 🎨 **Modern Interface**
- 🎨 **Beautiful UI** - Glassmorphism design with gradient backgrounds
- 📱 **Responsive Design** - Works perfectly on all screen sizes
- 🔒 **Secure Architecture** - Built with Tauri for maximum security
- ⚡ **Native Performance** - Small bundle size (~10-20MB vs Electron's 100MB+)

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js
- [Rust](https://rustup.rs/) (for Tauri)
- **No need for Hardhat!** - The GUI can install it for you

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <your-repo>
   cd hardhat-gui
   bun install
   ```

2. **Run the GUI:**
   ```bash
   bun run tauri dev
   ```

3. **Follow the GUI prompts:**
   - If Hardhat isn't installed, click "📦 Install Hardhat"
   - Select or create a project directory
   - Create a new Hardhat project or point to existing one
   - Start the network with one click

## 🛠 Usage Workflow

### **First Time Setup:**
1. **Launch the GUI** - Run `bun run tauri dev`
2. **Install Hardhat** - Click the install button if not already installed
3. **Select Directory** - Choose where to create/find your Hardhat project
4. **Create Project** - Initialize a new Hardhat project (or select existing)
5. **Start Network** - Launch the local blockchain
6. **Monitor Accounts** - View all accounts and balances in real-time

### **Daily Development:**
1. **Open GUI** - Automatically detects your setup
2. **Start Network** - One-click network startup
3. **Monitor Activity** - Real-time blockchain monitoring
4. **Refresh Data** - Update balances and network info

## 🎯 Smart Features

### **Intelligent Detection**
- ✅ **Installation Check** - Detects global Hardhat installation
- ✅ **Project Detection** - Finds `hardhat.config.js/ts` files
- ✅ **Network Status** - Checks if localhost:8545 is active
- ✅ **Version Display** - Shows installed Hardhat version

### **One-Click Operations**
- 📦 **Install Hardhat** - `npm install -g hardhat`
- 🆕 **Create Project** - `npx hardhat init --yes`
- 🚀 **Start Network** - `npx hardhat node`
- 🔄 **Refresh Status** - Updates all information

### **Error Handling**
- 🚨 **Clear Error Messages** - Helpful error descriptions
- 🔄 **Retry Mechanisms** - Easy retry for failed operations
- 📍 **Status Indicators** - Visual feedback for all operations

## 🛠 Development

### Available Scripts

- `bun run tauri dev` - Start development server
- `bun run tauri build` - Build for production
- `bun run dev` - Start frontend only (for testing)

### Tech Stack

- **Frontend:** React 18 + Vite
- **Backend:** Rust (Tauri) with shell/fs/dialog plugins
- **Blockchain:** ethers.js v6
- **Styling:** Modern CSS with glassmorphism effects
- **Package Manager:** Bun

### Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React UI      │    │   Tauri Rust     │    │   System        │
│                 │    │                  │    │                 │
│ • Status Display│◄──►│ • Shell Commands │◄──►│ • npm/npx       │
│ • Action Buttons│    │ • File System    │    │ • Hardhat CLI   │
│ • Error Handling│    │ • Network Checks │    │ • File System   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 📱 Screenshots & UI

The application features several key sections:

### **🔨 Hardhat Management Panel**
- **Status Grid** - Installation, Project, Network status
- **Action Buttons** - Install, Select, Create, Start operations
- **Progress Messages** - Real-time feedback during operations

### **📡 Network Information**
- **Chain Details** - Network name, Chain ID, Block number
- **Connection Status** - Visual indicators for network health

### **💰 Account Grid**
- **Account Cards** - Address, balance, and index for each account
- **Responsive Layout** - Adapts to screen size
- **Hover Effects** - Interactive card animations

## 🔧 Configuration

### **Default Settings**
- **RPC Endpoint:** `http://localhost:8545` (standard Hardhat)
- **Network Detection:** Automatic TCP connection check
- **Project Detection:** Looks for `hardhat.config.js` or `hardhat.config.ts`

### **Customization**
The app automatically adapts to your system:
- Detects existing Hardhat installations
- Works with any Hardhat project structure
- Supports both JavaScript and TypeScript configs

## 🏗 Building for Production

```bash
bun run tauri build
```

This creates optimized bundles for your platform in `src-tauri/target/release/bundle/`.

### **Bundle Sizes (Approximate)**
- **Linux AppImage:** ~15-25MB
- **Windows Installer:** ~20-30MB  
- **macOS DMG:** ~25-35MB

*Compare to Electron apps which are typically 100MB+*

## 🔒 Security Features

- **No Node.js in Frontend** - Eliminates common attack vectors
- **Sandboxed Shell Commands** - Only allowed npm/npx operations
- **File System Scoping** - Controlled file access
- **Secure IPC** - Type-safe communication between frontend/backend

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### **Development Setup**
```bash
# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Clone and setup
git clone <repo>
cd hardhat-gui
bun install

# Run in development
bun run tauri dev
```

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- [Tauri](https://tauri.app/) - For the amazing desktop app framework
- [Hardhat](https://hardhat.org/) - For the excellent Ethereum development environment
- [ethers.js](https://ethers.org/) - For blockchain interaction capabilities
- [React](https://reactjs.org/) - For the powerful UI framework

## 🚀 Roadmap

### **Planned Features**
- 📜 **Contract Deployment** - Deploy and interact with smart contracts
- 📊 **Transaction History** - View and filter transaction logs
- 🔗 **Network Switching** - Support for different networks
- 🎨 **Theme Customization** - Light/dark mode and custom themes
- 📈 **Gas Analytics** - Track gas usage and optimization
- 🔧 **Advanced Config** - Edit Hardhat configuration from GUI

### **Community Requests**
Have an idea? Open an issue or contribute directly!

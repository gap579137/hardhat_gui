import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import './App.css';

function App() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [networkInfo, setNetworkInfo] = useState(null);
  const [hardhatStatus, setHardhatStatus] = useState(null);
  const [selectedProjectPath, setSelectedProjectPath] = useState('');
  const [isManaging, setIsManaging] = useState(false);
  const [managementMessage, setManagementMessage] = useState('');

  const checkHardhatStatus = async (projectPath = null) => {
    try {
      const status = await invoke('check_hardhat_status', { projectPath });
      setHardhatStatus(status);
      return status;
    } catch (err) {
      console.error('Error checking Hardhat status:', err);
      setError(`Failed to check Hardhat status: ${err}`);
      return null;
    }
  };

  const loadBlockchainData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Connect to local Hardhat network
      const provider = new ethers.JsonRpcProvider("http://localhost:8545");
      
      // Get network info
      const network = await provider.getNetwork();
      const blockNumber = await provider.getBlockNumber();
      
      setNetworkInfo({
        name: network.name,
        chainId: Number(network.chainId),
        blockNumber: blockNumber
      });
      
      // Get accounts and balances
      const accountAddresses = await provider.listAccounts();
      const accountsWithBalances = await Promise.all(
        accountAddresses.map(async (address) => {
          const balance = await provider.getBalance(address);
          return {
            address: address,
            balance: ethers.formatEther(balance),
            shortAddress: `${address.slice(0, 6)}...${address.slice(-4)}`
          };
        })
      );
      
      setAccounts(accountsWithBalances);
    } catch (err) {
      setError(err.message);
      console.error('Error loading blockchain data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInstallHardhat = async () => {
    setIsManaging(true);
    setManagementMessage('Installing Hardhat globally...');
    
    try {
      const result = await invoke('install_hardhat');
      setManagementMessage(result);
      setTimeout(() => {
        checkHardhatStatus();
        setManagementMessage('');
      }, 2000);
    } catch (err) {
      setManagementMessage(`Installation failed: ${err}`);
    } finally {
      setIsManaging(false);
    }
  };

  const handleSelectProject = async () => {
    try {
      const selected = await open({
        directory: true,
        title: 'Select Hardhat Project Directory'
      });
      
      if (selected) {
        setSelectedProjectPath(selected);
        await checkHardhatStatus(selected);
      }
    } catch (err) {
      setError(`Failed to select directory: ${err}`);
    }
  };

  const handleCreateProject = async () => {
    if (!selectedProjectPath) {
      setError('Please select a directory first');
      return;
    }

    setIsManaging(true);
    setManagementMessage('Creating new Hardhat project...');
    
    try {
      const result = await invoke('create_hardhat_project', { 
        projectPath: selectedProjectPath 
      });
      setManagementMessage(result);
      setTimeout(() => {
        checkHardhatStatus(selectedProjectPath);
        setManagementMessage('');
      }, 2000);
    } catch (err) {
      setManagementMessage(`Project creation failed: ${err}`);
    } finally {
      setIsManaging(false);
    }
  };

  const handleStartNetwork = async () => {
    if (!hardhatStatus?.project_path) {
      setError('No Hardhat project detected');
      return;
    }

    setIsManaging(true);
    setManagementMessage('Starting Hardhat network...');
    
    try {
      const result = await invoke('start_hardhat_network', { 
        projectPath: hardhatStatus.project_path 
      });
      setManagementMessage(result);
      setTimeout(() => {
        checkHardhatStatus(hardhatStatus.project_path);
        loadBlockchainData();
        setManagementMessage('');
      }, 3000);
    } catch (err) {
      setManagementMessage(`Failed to start network: ${err}`);
    } finally {
      setIsManaging(false);
    }
  };

  const handleRefresh = async () => {
    await checkHardhatStatus(selectedProjectPath || null);
    if (hardhatStatus?.network_running) {
      await loadBlockchainData();
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      await checkHardhatStatus();
      if (hardhatStatus?.network_running) {
        await loadBlockchainData();
      } else {
        setLoading(false);
      }
    };
    
    initializeApp();
  }, []);

  // Hardhat Management Panel
  const renderHardhatManagement = () => (
    <div className="hardhat-management">
      <h3>🔨 Hardhat Management</h3>
      
      <div className="status-grid">
        <div className={`status-item ${hardhatStatus?.installed ? 'success' : 'warning'}`}>
          <span className="status-label">Installation:</span>
          <span className="status-value">
            {hardhatStatus?.installed ? `✅ Installed ${hardhatStatus.version || ''}` : '❌ Not Installed'}
          </span>
        </div>
        
        <div className={`status-item ${hardhatStatus?.project_detected ? 'success' : 'warning'}`}>
          <span className="status-label">Project:</span>
          <span className="status-value">
            {hardhatStatus?.project_detected ? '✅ Detected' : '❌ No Project'}
          </span>
        </div>
        
        <div className={`status-item ${hardhatStatus?.network_running ? 'success' : 'warning'}`}>
          <span className="status-label">Network:</span>
          <span className="status-value">
            {hardhatStatus?.network_running ? '✅ Running' : '❌ Not Running'}
          </span>
        </div>
      </div>

      {managementMessage && (
        <div className="management-message">
          {isManaging && <span className="spinner">⏳</span>}
          {managementMessage}
        </div>
      )}

      <div className="management-actions">
        {!hardhatStatus?.installed && (
          <button 
            onClick={handleInstallHardhat} 
            disabled={isManaging}
            className="action-btn install-btn"
          >
            📦 Install Hardhat
          </button>
        )}

        <button 
          onClick={handleSelectProject} 
          disabled={isManaging}
          className="action-btn select-btn"
        >
          📁 Select Project Directory
        </button>

        {selectedProjectPath && !hardhatStatus?.project_detected && (
          <button 
            onClick={handleCreateProject} 
            disabled={isManaging}
            className="action-btn create-btn"
          >
            🆕 Create Hardhat Project
          </button>
        )}

        {hardhatStatus?.project_detected && !hardhatStatus?.network_running && (
          <button 
            onClick={handleStartNetwork} 
            disabled={isManaging}
            className="action-btn start-btn"
          >
            🚀 Start Network
          </button>
        )}
      </div>

      {selectedProjectPath && (
        <div className="project-path">
          <strong>Selected Path:</strong> <code>{selectedProjectPath}</code>
        </div>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <h2>🔄 Loading Hardhat GUI...</h2>
          <p>Checking system status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <h1>🔨 Hardhat GUI</h1>
        <button onClick={handleRefresh} className="refresh-btn">
          🔄 Refresh
        </button>
      </header>

      {renderHardhatManagement()}

      {error && (
        <div className="error-banner">
          <h3>⚠️ Error</h3>
          <p>{error}</p>
          <button onClick={() => setError(null)} className="dismiss-btn">
            Dismiss
          </button>
        </div>
      )}

      {networkInfo && (
        <div className="network-info">
          <h3>📡 Network Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Network:</span>
              <span className="value">{networkInfo.name || 'Hardhat Local'}</span>
            </div>
            <div className="info-item">
              <span className="label">Chain ID:</span>
              <span className="value">{networkInfo.chainId}</span>
            </div>
            <div className="info-item">
              <span className="label">Block Number:</span>
              <span className="value">{networkInfo.blockNumber}</span>
            </div>
          </div>
        </div>
      )}

      {accounts.length > 0 && (
        <div className="accounts-section">
          <h3>💰 Local Accounts ({accounts.length})</h3>
          <div className="accounts-grid">
            {accounts.map((account, index) => (
              <div key={account.address} className="account-card">
                <div className="account-header">
                  <span className="account-index">#{index}</span>
                  <span className="account-balance">{parseFloat(account.balance).toFixed(4)} ETH</span>
                </div>
                <div className="account-address">
                  <code>{account.address}</code>
                </div>
                <div className="account-short">
                  {account.shortAddress}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <footer className="footer">
        <p>🚀 Built with Tauri + React</p>
      </footer>
    </div>
  );
}

export default App;

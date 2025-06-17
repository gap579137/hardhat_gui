import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import {
  MantineProvider,
  ColorSchemeScript,
  AppShell,
  Group,
  Title,
  Button,
  Card,
  Text,
  Grid,
  Badge,
  Paper,
  Stack,
  Code,
  Notification,
  Loader,
  ActionIcon,
  useMantineColorScheme,
  Container,
  Box,
  Alert,
  Flex,
  SimpleGrid,
  Center,
  Burger,
  NavLink,
  TextInput,
  Modal,
  Textarea
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { Notifications } from '@mantine/notifications';
import './App.css';

// Check if we're running in Tauri
const isTauri = typeof window !== 'undefined' && window.__TAURI_INTERNALS__;

// Theme toggle component
function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  
  return (
    <ActionIcon
      onClick={() => toggleColorScheme()}
      variant="default"
      size="xl"
      aria-label="Toggle color scheme"
    >
      {colorScheme === 'dark' ? '☀️' : '🌙'}
    </ActionIcon>
  );
}

function HardhatApp() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [networkInfo, setNetworkInfo] = useState(null);
  const [hardhatStatus, setHardhatStatus] = useState(null);
  const [selectedProjectPath, setSelectedProjectPath] = useState('');
  const [currentProjectPath, setCurrentProjectPath] = useState(''); // Track the active project path
  const [isManaging, setIsManaging] = useState(false);
  const [managementMessage, setManagementMessage] = useState('');
  const [tauriApis, setTauriApis] = useState({ invoke: null, open: null });
  const [opened, { toggle }] = useDisclosure();
  const [activeSection, setActiveSection] = useState('management');
  const [contracts, setContracts] = useState([]);
  const [compilationStatus, setCompilationStatus] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [deploymentStatus, setDeploymentStatus] = useState(null);
  const [consoleOutput, setConsoleOutput] = useState([]);
  const [consoleInput, setConsoleInput] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [isLoadingContracts, setIsLoadingContracts] = useState(false);
  const [verifyModalOpened, setVerifyModalOpened] = useState(false);
  const [verifyForm, setVerifyForm] = useState({
    contractAddress: '',
    constructorArgs: '',
    contractName: ''
  });

  // Load Tauri APIs dynamically
  useEffect(() => {
    const loadTauriApis = async () => {
      if (isTauri) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const { open } = await import('@tauri-apps/plugin-dialog');
          setTauriApis({ invoke, open });
        } catch (error) {
          console.warn('Failed to import Tauri APIs:', error);
        }
      }
    };
    
    loadTauriApis();
  }, []);

  const checkHardhatStatus = async (projectPath = null) => {
    if (!isTauri || !tauriApis.invoke) {
      setHardhatStatus({
        installed: false,
        version: null,
        project_detected: false,
        project_path: null,
        network_running: false
      });
      return null;
    }

    try {
      const status = await tauriApis.invoke('check_hardhat_status', { projectPath });
      setHardhatStatus(status);
      
      // Update current project path if project is detected
      if (status?.project_detected && status?.project_path) {
        setCurrentProjectPath(status.project_path);
        setSelectedProjectPath(status.project_path);
      }
      
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
      
      const provider = new ethers.JsonRpcProvider("http://localhost:8545");
      
      const network = await provider.getNetwork();
      const blockNumber = await provider.getBlockNumber();
      
      setNetworkInfo({
        name: network.name,
        chainId: Number(network.chainId),
        blockNumber: blockNumber
      });
      
      const accountAddresses = await provider.listAccounts();
      const accountsWithBalances = await Promise.all(
        accountAddresses.map(async (account) => {
          const address = typeof account === 'string' ? account : account.address;
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
    if (!isTauri || !tauriApis.invoke) {
      setError('Hardhat installation requires the desktop app');
      return;
    }

    setIsManaging(true);
    setManagementMessage('Installing Hardhat globally...');
    
    try {
      const result = await tauriApis.invoke('install_hardhat');
      notifications.show({
        title: 'Installation Complete',
        message: result,
        color: 'green',
      });
      setTimeout(() => {
        checkHardhatStatus();
        setManagementMessage('');
      }, 2000);
    } catch (err) {
      notifications.show({
        title: 'Installation Failed',
        message: err.toString(),
        color: 'red',
      });
      setManagementMessage(`Installation failed: ${err}`);
    } finally {
      setIsManaging(false);
    }
  };

  const handleSelectProject = async () => {
    if (!isTauri || !tauriApis.open) {
      setError('Project selection requires the desktop app');
      return;
    }

    try {
      const selected = await tauriApis.open({
        directory: true,
        title: 'Select Hardhat Project Directory'
      });
      
      if (selected) {
        setSelectedProjectPath(selected);
        const status = await checkHardhatStatus(selected);
        // If project is detected, keep the selected path for future operations
        if (status?.project_detected) {
          console.log('Project detected at:', selected);
        }
      }
    } catch (err) {
      setError(`Failed to select directory: ${err}`);
    }
  };

  const handleCreateProject = async () => {
    if (!isTauri || !tauriApis.invoke) {
      setError('Project creation requires the desktop app');
      return;
    }

    if (!selectedProjectPath) {
      setError('Please select a directory first');
      return;
    }

    setIsManaging(true);
    setManagementMessage('Creating new Hardhat project...');
    
    try {
      const result = await tauriApis.invoke('create_hardhat_project', { 
        projectPath: selectedProjectPath 
      });
      notifications.show({
        title: 'Project Created',
        message: result,
        color: 'green',
      });
      setTimeout(async () => {
        await checkHardhatStatus(selectedProjectPath);
        setManagementMessage('');
      }, 2000);
    } catch (err) {
      notifications.show({
        title: 'Project Creation Failed',
        message: err.toString(),
        color: 'red',
      });
      setManagementMessage(`Project creation failed: ${err}`);
    } finally {
      setIsManaging(false);
    }
  };

  const handleStartNetwork = async () => {
    if (!isTauri || !tauriApis.invoke) {
      setError('Network management requires the desktop app');
      return;
    }

    const projectPath = currentProjectPath || hardhatStatus?.project_path;
    if (!projectPath) {
      setError('No Hardhat project detected');
      return;
    }

    console.log('Starting network for project at:', projectPath);
    setIsManaging(true);
    setManagementMessage('Starting Hardhat network...');
    
    try {
      const result = await tauriApis.invoke('start_hardhat_network', { 
        projectPath: projectPath 
      });
      notifications.show({
        title: 'Network Started',
        message: result,
        color: 'green',
      });
      setTimeout(async () => {
        console.log('Checking status after network start for:', projectPath);
        await checkHardhatStatus(projectPath);
        await loadBlockchainData();
        setManagementMessage('');
      }, 3000);
    } catch (err) {
      notifications.show({
        title: 'Network Start Failed',
        message: err.toString(),
        color: 'red',
      });
      setManagementMessage(`Network start failed: ${err}`);
    } finally {
      setIsManaging(false);
    }
  };

  const handleRefresh = async () => {
    // Use the current project path if available, prioritizing the tracked current path
    const projectPath = currentProjectPath || hardhatStatus?.project_path || selectedProjectPath || null;
    console.log('Refreshing with project path:', projectPath);
    await checkHardhatStatus(projectPath);
    await loadBlockchainData();
  };

  const toggleAutoRefresh = () => {
    if (autoRefresh) {
      // Stop auto-refresh
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
      setAutoRefresh(false);
    } else {
      // Start auto-refresh every 10 seconds
      const interval = setInterval(handleRefresh, 10000);
      setRefreshInterval(interval);
      setAutoRefresh(true);
    }
  };

  // Load contracts when project path changes
  const loadContracts = async () => {
    if (!currentProjectPath || !isTauri || !tauriApis.invoke) return;
    
    setIsLoadingContracts(true);
    try {
      const contractsList = await tauriApis.invoke('list_contracts', { 
        projectPath: currentProjectPath 
      });
      setContracts(contractsList);
    } catch (err) {
      console.error('Error loading contracts:', err);
    } finally {
      setIsLoadingContracts(false);
    }
  };

  // Hardhat-specific functions
  const handleCompileContracts = async () => {
    if (!currentProjectPath || !isTauri || !tauriApis.invoke) return;
    
    setIsManaging(true);
    setManagementMessage('Compiling contracts...');
    
    try {
      const result = await tauriApis.invoke('compile_contracts', { 
        projectPath: currentProjectPath 
      });
      setCompilationStatus({ success: true, message: result });
      notifications.show({
        title: 'Compilation Successful',
        message: 'All contracts compiled successfully',
        color: 'green',
      });
      
      // Wait a bit for artifacts to be written, then reload contracts
      setManagementMessage('Updating contract status...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      await loadContracts(); // Reload to update compilation status
      
      notifications.show({
        title: 'Contracts Updated',
        message: 'Contract compilation status refreshed',
        color: 'blue',
      });
      
    } catch (err) {
      setCompilationStatus({ success: false, message: err.toString() });
      notifications.show({
        title: 'Compilation Failed',
        message: err.toString(),
        color: 'red',
      });
    } finally {
      setIsManaging(false);
      setManagementMessage('');
    }
  };

  const handleRunTests = async () => {
    if (!currentProjectPath || !isTauri || !tauriApis.invoke) return;
    
    setIsManaging(true);
    setManagementMessage('Running tests...');
    
    try {
      const result = await tauriApis.invoke('run_tests', { 
        projectPath: currentProjectPath 
      });
      setTestResults({ success: true, message: result });
      notifications.show({
        title: 'Tests Completed',
        message: 'All tests passed successfully',
        color: 'green',
      });
    } catch (err) {
      setTestResults({ success: false, message: err.toString() });
      notifications.show({
        title: 'Tests Failed',
        message: 'Some tests failed',
        color: 'red',
      });
    } finally {
      setIsManaging(false);
      setManagementMessage('');
    }
  };

  const handleDeployContracts = async () => {
    if (!currentProjectPath || !isTauri || !tauriApis.invoke) return;
    
    setIsManaging(true);
    setManagementMessage('Deploying contracts...');
    
    try {
      const result = await tauriApis.invoke('deploy_contracts', { 
        projectPath: currentProjectPath 
      });
      setDeploymentStatus({ success: true, message: result });
      notifications.show({
        title: 'Deployment Successful',
        message: 'Contracts deployed successfully',
        color: 'green',
      });
    } catch (err) {
      setDeploymentStatus({ success: false, message: err.toString() });
      notifications.show({
        title: 'Deployment Failed',
        message: err.toString(),
        color: 'red',
      });
    } finally {
      setIsManaging(false);
      setManagementMessage('');
    }
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [refreshInterval]);

  // Load contracts when project changes
  useEffect(() => {
    if (currentProjectPath) {
      loadContracts();
    }
  }, [currentProjectPath, tauriApis.invoke]);

  useEffect(() => {
    const initializeApp = async () => {
      if (isTauri) {
        await checkHardhatStatus();
        if (hardhatStatus?.network_running) {
          await loadBlockchainData();
        } else {
          setLoading(false);
        }
      } else {
        await loadBlockchainData();
      }
    };
    
    if (isTauri && !tauriApis.invoke) {
      return;
    }
    
    initializeApp();
  }, [tauriApis.invoke, hardhatStatus?.network_running]);

  // Network Information Panel
  const renderNetworkInfo = () => {
    if (!networkInfo) {
      return (
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Group justify="space-between" mb="sm">
            <Title order={4} c="blue">📡 Network Information</Title>
            <Badge color="red" variant="filled">Disconnected</Badge>
          </Group>
          <Text c="dimmed" ta="center">No network connection detected</Text>
          <Text size="xs" c="dimmed" ta="center" mt="xs">
            Make sure Hardhat network is running on localhost:8545
          </Text>
        </Card>
      );
    }

    return (
      <Card shadow="sm" padding="md" radius="md" withBorder>
        <Group justify="space-between" mb="sm">
          <Title order={4} c="blue">📡 Network Information</Title>
          <Badge color="green" variant="filled">Connected</Badge>
        </Group>
        
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mb="md">
          <Paper p="md" withBorder ta="center">
            <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb="xs">Network</Text>
            <Text fw={700} ff="monospace">{networkInfo.name || 'Hardhat Local'}</Text>
          </Paper>
          <Paper p="md" withBorder ta="center">
            <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb="xs">Chain ID</Text>
            <Text fw={700} ff="monospace">{networkInfo.chainId}</Text>
          </Paper>
          <Paper p="md" withBorder ta="center">
            <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb="xs">Block Number</Text>
            <Text fw={700} ff="monospace">{networkInfo.blockNumber}</Text>
          </Paper>
        </SimpleGrid>

        <Paper p="sm" withBorder mb="sm">
          <Group justify="space-between" mb="sm">
            <Text size="xs" fw={600}>RPC Endpoint</Text>
            <Code size="xs">http://localhost:8545</Code>
          </Group>
          <Group justify="space-between">
            <Text size="xs" fw={600}>Gas Price</Text>
            <Text size="xs" c="dimmed">Auto (Hardhat Network)</Text>
          </Group>
        </Paper>

        <Paper p="sm" withBorder>
          <Text size="xs" fw={600} mb="xs">Available Hardhat Tasks:</Text>
          <Group gap="xs" mb="xs">
            <Button 
              size="xs" 
              variant="subtle" 
              color="blue"
              onClick={() => handleHardhatTask('clean')}
              disabled={!currentProjectPath}
            >
              Clean
            </Button>
            <Button 
              size="xs" 
              variant="subtle" 
              color="purple"
              onClick={() => handleHardhatTask('flatten')}
              disabled={!currentProjectPath}
            >
              Flatten
            </Button>
            <Button 
              size="xs" 
              variant="subtle" 
              color="orange"
              onClick={() => handleHardhatTask('coverage')}
              disabled={!currentProjectPath}
            >
              Coverage
            </Button>
            <Button 
              size="xs" 
              variant="subtle" 
              color="teal"
              onClick={() => handleHardhatTask('verify')}
              disabled={!currentProjectPath}
            >
              Verify Contract
            </Button>
          </Group>
          <Text size="xs" c="dimmed">
            💡 Deploy contracts first to get addresses for verification
          </Text>
        </Paper>
      </Card>
    );
  };

  // Accounts Panel
  const renderAccounts = () => {
    if (accounts.length === 0) {
      return (
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Group justify="space-between" mb="sm">
            <Title order={4} c="green">💰 Local Accounts</Title>
            <Badge color="red" variant="light">No accounts</Badge>
          </Group>
          <Text c="dimmed" ta="center">No accounts detected</Text>
          <Text size="xs" c="dimmed" ta="center" mt="xs">
            Start Hardhat network to see test accounts
          </Text>
        </Card>
      );
    }

    const totalBalance = accounts.reduce((sum, account) => sum + parseFloat(account.balance), 0);

    return (
      <Card shadow="sm" padding="md" radius="md" withBorder>
        <Group justify="space-between" mb="sm">
          <Title order={4} c="green">💰 Local Accounts ({accounts.length})</Title>
          <Badge color="green" variant="light">
            Total: {totalBalance.toFixed(2)} ETH
          </Badge>
        </Group>
        
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {accounts.map((account, index) => (
            <Paper key={account.address} p="md" withBorder>
              <Group justify="space-between" mb="sm">
                <Badge color="green" variant="filled" size="sm">
                  #{index}
                </Badge>
                <Text fw={700} size="md" c="orange">
                  {parseFloat(account.balance).toFixed(4)} ETH
                </Text>
              </Group>
              <Box mb="xs">
                <Code block size="xs">{account.address}</Code>
              </Box>
              <Group justify="space-between" mt="xs">
                <Text c="dimmed" size="xs">
                  {account.shortAddress}
                </Text>
                <Group gap="xs">
                  <Button 
                    size="xs" 
                    variant="subtle" 
                    color="blue"
                    onClick={() => handleCopyAddress(account.address)}
                  >
                    Copy
                  </Button>
                  <Button 
                    size="xs" 
                    variant="subtle" 
                    color="orange"
                    onClick={() => handleSendEth(account.address)}
                  >
                    Send
                  </Button>
                </Group>
              </Group>
            </Paper>
          ))}
        </SimpleGrid>
      </Card>
    );
  };

  // Hardhat Management Panel
  const renderHardhatManagement = () => {
    if (!isTauri) {
      return (
        <Card shadow="sm" padding="lg" radius="md" withBorder mb="xl">
          <Title order={3} c="orange" mb="md">🔨 Hardhat Management</Title>
          <Alert variant="light" color="yellow" title="Browser Mode">
            <Text size="sm">
              You're running in browser mode. For full Hardhat management features, please use the desktop app.
              You can still view blockchain data if you have a Hardhat network running on localhost:8545.
            </Text>
          </Alert>
        </Card>
      );
    }

    return (
      <Card shadow="sm" padding="md" radius="md" withBorder mb="lg">
        <Title order={4} c="orange" mb="sm">🔨 Hardhat Management</Title>
        
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs" mb="sm">
          <Paper 
            p="sm" 
            withBorder 
            style={{ 
              borderLeft: `3px solid var(--mantine-color-${hardhatStatus?.installed ? 'green' : 'yellow'}-6)` 
            }}
          >
            <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb={4}>Installation</Text>
            <Text size="xs" ff="monospace">
              {hardhatStatus?.installed ? `✅ Installed ${hardhatStatus.version || ''}` : '❌ Not Installed'}
            </Text>
          </Paper>
          
          <Paper 
            p="sm" 
            withBorder 
            style={{ 
              borderLeft: `3px solid var(--mantine-color-${hardhatStatus?.project_detected ? 'green' : 'yellow'}-6)` 
            }}
          >
            <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb={4}>Project</Text>
            <Text size="xs" ff="monospace">
              {hardhatStatus?.project_detected ? '✅ Detected' : '❌ No Project'}
            </Text>
          </Paper>
          
          <Paper 
            p="sm" 
            withBorder 
            style={{ 
              borderLeft: `3px solid var(--mantine-color-${hardhatStatus?.network_running ? 'green' : 'yellow'}-6)` 
            }}
          >
            <Text size="xs" fw={600} tt="uppercase" c="dimmed" mb={4}>Network</Text>
            <Text size="xs" ff="monospace">
              {hardhatStatus?.network_running ? '✅ Running' : '❌ Not Running'}
            </Text>
          </Paper>
        </SimpleGrid>

        {managementMessage && (
          <Notification color="blue" title="Status" onClose={() => setManagementMessage('')} mb="sm">
            <Group gap="xs">
              {isManaging && <Loader size="xs" />}
              <Text size="sm">{managementMessage}</Text>
            </Group>
          </Notification>
        )}

        <Group gap="xs" mb="sm">
          {!hardhatStatus?.installed && (
            <Button 
              onClick={handleInstallHardhat} 
              disabled={isManaging}
              color="green"
              leftSection="📦"
              size="xs"
            >
              Install Hardhat
            </Button>
          )}

          <Button 
            onClick={handleSelectProject} 
            disabled={isManaging}
            color="blue"
            leftSection="📁"
            size="xs"
          >
            Select Project Directory
          </Button>

          {selectedProjectPath && !hardhatStatus?.project_detected && (
            <Button 
              onClick={handleCreateProject} 
              disabled={isManaging}
              color="cyan"
              leftSection="🆕"
              size="xs"
            >
              Create Hardhat Project
            </Button>
          )}

          {hardhatStatus?.project_detected && !hardhatStatus?.network_running && (
            <Button 
              onClick={handleStartNetwork} 
              disabled={isManaging}
              color="orange"
              leftSection="🚀"
              size="xs"
            >
              Start Network
            </Button>
          )}
        </Group>

        {selectedProjectPath && (
          <Paper p="sm" withBorder>
            <Text fw={600} mb={4} size="xs">Selected Path:</Text>
            <Code block size="xs">{selectedProjectPath}</Code>
          </Paper>
        )}
      </Card>
    );
  };

  // Contracts Panel
  const renderContracts = () => {
    return (
      <Stack gap="md">
        <Card shadow="sm" padding="md" radius="md" withBorder>
          <Group justify="space-between" mb="sm">
            <Title order={4} c="purple">📋 Smart Contracts</Title>
            <Group gap="xs">
              {isLoadingContracts && <Loader size="xs" />}
              <Badge color="purple" variant="light">{contracts.length} contracts</Badge>
            </Group>
          </Group>
          
          {!currentProjectPath ? (
            <Text c="dimmed" ta="center">Select a Hardhat project to view contracts</Text>
          ) : (
            <Stack gap="md">
              <Paper p="sm" withBorder >
                <Group justify="space-between" mb="sm">
                  <Text size="sm" fw={600}>Project Actions</Text>
                  <Text size="xs" c="dimmed">{currentProjectPath.split('/').pop()}</Text>
                </Group>
                <Group gap="xs">
                  <Button 
                    size="xs" 
                    variant="light" 
                    color="blue"
                    onClick={handleCompileContracts}
                    disabled={isManaging}
                    leftSection="🔨"
                  >
                    Compile
                  </Button>
                  <Button 
                    size="xs" 
                    variant="light" 
                    color="orange"
                    onClick={handleRunTests}
                    disabled={isManaging}
                    leftSection="🧪"
                  >
                    Test
                  </Button>
                  <Button 
                    size="xs" 
                    variant="light" 
                    color="green"
                    onClick={handleDeployContracts}
                    disabled={isManaging}
                    leftSection="🚀"
                  >
                    Deploy
                  </Button>
                </Group>
              </Paper>
              
              {contracts.length === 0 ? (
                <Paper p="md" withBorder>
                  <Text ta="center" c="dimmed">No contracts found</Text>
                  <Text ta="center" size="xs" c="dimmed" mt="xs">
                    Add .sol files to the contracts/ directory
                  </Text>
                </Paper>
              ) : (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  {contracts.map((contract, index) => (
                    <Paper key={index} p="md" withBorder>
                      <Group justify="space-between" mb="xs">
                        <Text fw={600} size="sm">{contract.name}</Text>
                        <Badge 
                          color={contract.compiled ? "green" : "yellow"} 
                          size="xs"
                        >
                          {contract.compiled ? "Compiled" : "Not Compiled"}
                        </Badge>
                      </Group>
                      <Text size="xs" c="dimmed" mb="xs">
                        {contract.path.replace(currentProjectPath + '/', '')}
                      </Text>
                      {contract.size && (
                        <Text size="xs" c="dimmed" mb="sm">
                          Size: {(contract.size / 1024).toFixed(1)} KB
                        </Text>
                      )}
                      <Group gap="xs">
                        <Button 
                          size="xs" 
                          variant="subtle" 
                          color="blue"
                          onClick={() => handleViewContract(contract)}
                        >
                          View
                        </Button>
                        <Button 
                          size="xs" 
                          variant="subtle" 
                          color="orange"
                          onClick={() => handleEditContract(contract)}
                        >
                          Edit
                        </Button>
                      </Group>
                    </Paper>
                  ))}
                </SimpleGrid>
              )}
            </Stack>
          )}
        </Card>

        {/* Compilation Status */}
        {compilationStatus && (
          <Card shadow="sm" padding="md" radius="md" withBorder>
            <Group justify="space-between" mb="sm">
              <Title order={5} c={compilationStatus.success ? "green" : "red"}>
                🔨 Compilation Results
              </Title>
              <Badge color={compilationStatus.success ? "green" : "red"}>
                {compilationStatus.success ? "Success" : "Failed"}
              </Badge>
            </Group>
            <Code block size="xs" style={{ maxHeight: '200px', overflow: 'auto' }}>
              {compilationStatus.message}
            </Code>
          </Card>
        )}

        {/* Test Results */}
        {testResults && (
          <Card shadow="sm" padding="md" radius="md" withBorder>
            <Group justify="space-between" mb="sm">
              <Title order={5} c={testResults.success ? "green" : "red"}>
                🧪 Test Results
              </Title>
              <Badge color={testResults.success ? "green" : "red"}>
                {testResults.success ? "Passed" : "Failed"}
              </Badge>
            </Group>
            <Code block size="xs" style={{ maxHeight: '200px', overflow: 'auto' }}>
              {testResults.message}
            </Code>
          </Card>
        )}

        {/* Deployment Status */}
        {deploymentStatus && (
          <Card shadow="sm" padding="md" radius="md" withBorder>
            <Group justify="space-between" mb="sm">
              <Title order={5} c={deploymentStatus.success ? "green" : "red"}>
                🚀 Deployment Results
              </Title>
              <Badge color={deploymentStatus.success ? "green" : "red"}>
                {deploymentStatus.success ? "Deployed" : "Failed"}
              </Badge>
            </Group>
            {deploymentStatus.success && (
              <Paper p="xs" withBorder mb="sm" style={{ backgroundColor: 'var(--mantine-color-green-0)' }}>
                <Text size="xs" fw={600} c="green">
                  💡 Copy contract addresses from the output below to verify them on Etherscan
                </Text>
              </Paper>
            )}
            <Code block size="xs" style={{ maxHeight: '200px', overflow: 'auto' }}>
              {deploymentStatus.message}
            </Code>
          </Card>
        )}
      </Stack>
    );
  };

  // Transactions Panel
  const renderTransactions = () => {
    return (
      <Card shadow="sm" padding="md" radius="md" withBorder>
        <Group justify="space-between" mb="sm">
          <Title order={4} c="cyan">📜 Transaction History</Title>
          <Badge color="blue" variant="light">{transactions.length} txns</Badge>
        </Group>
        
        {transactions.length === 0 ? (
          <Paper p="lg" withBorder>
            <Text ta="center" c="dimmed">No transactions yet</Text>
            <Text ta="center" size="xs" c="dimmed" mt="xs">
              Transactions will appear here when you interact with contracts
            </Text>
          </Paper>
        ) : (
          <Stack gap="xs">
            {transactions.slice(0, 10).map((tx, index) => (
              <Paper key={index} p="sm" withBorder>
                <Group justify="space-between" mb="xs">
                  <Code size="xs">{tx.hash}</Code>
                  <Badge color={tx.status === 'success' ? 'green' : 'red'} size="xs">
                    {tx.status}
                  </Badge>
                </Group>
                <Group justify="space-between">
                  <Text size="xs" c="dimmed">
                    From: {tx.from} → To: {tx.to}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {tx.value} ETH
                  </Text>
                </Group>
              </Paper>
            ))}
            {transactions.length > 10 && (
              <Text ta="center" size="xs" c="dimmed">
                Showing latest 10 transactions
              </Text>
            )}
          </Stack>
        )}
      </Card>
    );
  };

  // Hardhat Console Panel
  const renderHardhatConsole = () => {
    const handleConsoleCommand = async () => {
      if (!consoleInput.trim() || !currentProjectPath || !isTauri || !tauriApis.invoke) return;
      
      const command = consoleInput.trim();
      setConsoleOutput(prev => [...prev, { type: 'input', content: `> ${command}` }]);
      setConsoleInput('');
      
      try {
        // Use the specialized console command function
        const result = await tauriApis.invoke('run_hardhat_console_command', { 
          projectPath: currentProjectPath,
          command: command
        });
        setConsoleOutput(prev => [...prev, { type: 'output', content: result }]);
      } catch (err) {
        setConsoleOutput(prev => [...prev, { type: 'error', content: err.toString() }]);
      }
    };

    return (
      <Card shadow="sm" padding="md" radius="md" withBorder>
        <Group justify="space-between" mb="sm">
          <Title order={4} c="teal">⚡ Hardhat Console</Title>
          <Group gap="xs">
            <Button 
              size="xs" 
              variant="subtle" 
              color="gray"
              onClick={() => setConsoleOutput([])}
            >
              Clear
            </Button>
            <Badge color="teal" variant="light">Interactive</Badge>
          </Group>
        </Group>
        
        {!currentProjectPath ? (
          <Text c="dimmed" ta="center">Select a Hardhat project to use console</Text>
        ) : (
          <Stack gap="md">
            <Paper 
              p="md" 
              withBorder 
              style={{ 
                backgroundColor: 'var(--mantine-color-dark-8)',
                color: 'var(--mantine-color-green-4)',
                fontFamily: 'monospace',
                fontSize: '12px',
                minHeight: '300px',
                maxHeight: '400px',
                overflow: 'auto'
              }}
            >
              {consoleOutput.length === 0 ? (
                <Text c="dimmed" size="xs">
                  Hardhat Console - Enter JavaScript code to interact with your contracts
                  <br />
                  Example: return await ethers.getSigners()
                  <br />
                  Use 'return' to see results, or just run code without return for side effects
                </Text>
              ) : (
                <Stack gap="xs">
                  {consoleOutput.map((entry, index) => (
                    <Text 
                      key={index} 
                      c={entry.type === 'error' ? 'red' : entry.type === 'input' ? 'cyan' : 'green'}
                      style={{ whiteSpace: 'pre-wrap' }}
                    >
                      {entry.content}
                    </Text>
                  ))}
                </Stack>
              )}
            </Paper>
            
            <Group gap="xs">
              <TextInput
                value={consoleInput}
                onChange={(e) => setConsoleInput(e.target.value)}
                placeholder="Enter Hardhat command..."
                style={{ flex: 1 }}
                onKeyPress={(e) => e.key === 'Enter' && handleConsoleCommand()}
                size="sm"
              />
              <Button 
                onClick={handleConsoleCommand}
                size="sm"
                disabled={!consoleInput.trim()}
              >
                Run
              </Button>
            </Group>
            
                          <Paper p="sm" withBorder style={{ backgroundColor: 'var(--mantine-color-blue-0)' }}>
                <Text size="xs" fw={600} mb="xs">Quick Commands:</Text>
                <Stack gap="xs">
                  <Group gap="xs">
                    <Button 
                      size="xs" 
                      variant="subtle"
                      onClick={() => setConsoleInput('return await ethers.getSigners()')}
                    >
                      Get Signers
                    </Button>
                    <Button 
                      size="xs" 
                      variant="subtle"
                      onClick={() => setConsoleInput('return await provider.getBlockNumber()')}
                    >
                      Block Number
                    </Button>
                    <Button 
                      size="xs" 
                      variant="subtle"
                      onClick={() => setConsoleInput('return await provider.getNetwork()')}
                    >
                      Network Info
                    </Button>
                    <Button 
                      size="xs" 
                      variant="subtle"
                      onClick={() => setConsoleInput('const signers = await ethers.getSigners(); return signers.map(s => s.address)')}
                    >
                      All Addresses
                    </Button>
                  </Group>
                  <Group gap="xs">
                    <Button 
                      size="xs" 
                      variant="subtle"
                      onClick={() => setConsoleInput('const [owner] = await ethers.getSigners(); const balance = await provider.getBalance(owner.address); return ethers.formatEther(balance) + " ETH"')}
                    >
                      Owner Balance
                    </Button>
                    <Button 
                      size="xs" 
                      variant="subtle"
                      onClick={() => setConsoleInput('const gasPrice = await provider.getGasPrice(); return ethers.formatUnits(gasPrice, "gwei") + " gwei"')}
                    >
                      Gas Price
                    </Button>
                    <Button 
                      size="xs" 
                      variant="subtle"
                      onClick={() => setConsoleInput('const block = await provider.getBlock("latest"); return { number: block.number, timestamp: new Date(block.timestamp * 1000).toISOString(), gasUsed: block.gasUsed.toString() }')}
                    >
                      Latest Block
                    </Button>
                    <Button 
                      size="xs" 
                      variant="subtle"
                      onClick={() => setConsoleInput('return ethers.parseEther("1.0").toString() + " wei = 1 ETH"')}
                    >
                      Parse ETH
                    </Button>
                  </Group>
                </Stack>
              </Paper>
          </Stack>
        )}
      </Card>
    );
  };

  // Add missing functionality for buttons
  const handleHardhatTask = async (taskName) => {
    if (!currentProjectPath || !isTauri || !tauriApis.invoke) return;
    
    // Special handling for verify task
    if (taskName === 'verify') {
      setVerifyModalOpened(true);
      return;
    }
    
    try {
      const result = await tauriApis.invoke('run_hardhat_task', { 
        projectPath: currentProjectPath,
        task: taskName,
        args: []
      });
      notifications.show({
        title: `${taskName} Task Completed`,
        message: result.substring(0, 100) + (result.length > 100 ? '...' : ''),
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: `${taskName} Task Failed`,
        message: err.toString(),
        color: 'red',
      });
    }
  };

  const handleVerifyContract = async () => {
    if (!currentProjectPath || !tauriApis.invoke || !verifyForm.contractAddress) {
      notifications.show({
        title: 'Verification Failed',
        message: 'Please provide a contract address',
        color: 'red',
      });
      return;
    }

    setIsManaging(true);
    setManagementMessage('Verifying contract...');
    
    try {
      const args = [verifyForm.contractAddress];
      
      // Add contract name if provided
      if (verifyForm.contractName) {
        args.push('--contract', verifyForm.contractName);
      }
      
      // Add constructor arguments if provided
      if (verifyForm.constructorArgs) {
        // Split constructor args by comma and trim whitespace
        const constructorArgs = verifyForm.constructorArgs
          .split(',')
          .map(arg => arg.trim())
          .filter(arg => arg.length > 0);
        
        if (constructorArgs.length > 0) {
          args.push('--constructor-args', ...constructorArgs);
        }
      }

      const result = await tauriApis.invoke('run_hardhat_task', { 
        projectPath: currentProjectPath,
        task: 'verify',
        args: args
      });
      
      notifications.show({
        title: 'Verification Successful',
        message: 'Contract verified successfully',
        color: 'green',
      });
      
      setVerifyModalOpened(false);
      setVerifyForm({ contractAddress: '', constructorArgs: '', contractName: '' });
      
    } catch (err) {
      notifications.show({
        title: 'Verification Failed',
        message: err.toString(),
        color: 'red',
      });
    } finally {
      setIsManaging(false);
      setManagementMessage('');
    }
  };

  const handleCopyAddress = async (address) => {
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(address);
        notifications.show({
          title: 'Address Copied',
          message: `${address.substring(0, 10)}... copied to clipboard`,
          color: 'green',
        });
      } catch (err) {
        notifications.show({
          title: 'Copy Failed',
          message: 'Failed to copy address to clipboard',
          color: 'red',
        });
      }
    }
  };

  const handleSendEth = (address) => {
    // For now, just show a notification - in a real app you'd open a send dialog
    notifications.show({
      title: 'Send ETH',
      message: `Send ETH feature would open for ${address.substring(0, 10)}...`,
      color: 'blue',
    });
  };

  const handleViewContract = (contract) => {
    // For now, just show a notification - in a real app you'd open the contract file
    notifications.show({
      title: 'View Contract',
      message: `Would open ${contract.name}.sol for viewing`,
      color: 'blue',
    });
  };

  const handleEditContract = (contract) => {
    // For now, just show a notification - in a real app you'd open the contract in an editor
    notifications.show({
      title: 'Edit Contract',
      message: `Would open ${contract.name}.sol for editing`,
      color: 'blue',
    });
  };

  // Render current section
  const renderCurrentSection = () => {
    switch (activeSection) {
      case 'management':
        return renderHardhatManagement();
      case 'network':
        return renderNetworkInfo();
      case 'accounts':
        return renderAccounts();
      case 'contracts':
        return renderContracts();
      case 'transactions':
        return renderTransactions();
      case 'console':
        return renderHardhatConsole();
      default:
        return renderHardhatManagement();
    }
  };

  if (loading) {
    return (
      <Container h="100vh">
        <Center h="100%">
          <Stack align="center" gap="md">
            <Loader size="xl" />
            <Title order={2} c="orange">🔄 Loading Hardhat GUI...</Title>
            <Text c="dimmed">Checking system status...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  return (
    <>
      {/* Contract Verification Modal */}
      <Modal
        opened={verifyModalOpened}
        onClose={() => setVerifyModalOpened(false)}
        title="🔍 Verify Contract on Etherscan"
        size="md"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Enter the contract details to verify on Etherscan. Make sure your contract is deployed and you have the correct address.
          </Text>
          
          <TextInput
            label="Contract Address"
            placeholder="0x..."
            value={verifyForm.contractAddress}
            onChange={(e) => setVerifyForm(prev => ({ ...prev, contractAddress: e.target.value }))}
            required
            description="The deployed contract address to verify"
          />
          
          <TextInput
            label="Contract Name (Optional)"
            placeholder="MyContract"
            value={verifyForm.contractName}
            onChange={(e) => setVerifyForm(prev => ({ ...prev, contractName: e.target.value }))}
            description="Specify if you have multiple contracts with the same name"
          />
          
          <Textarea
            label="Constructor Arguments (Optional)"
            placeholder="arg1, arg2, arg3"
            value={verifyForm.constructorArgs}
            onChange={(e) => setVerifyForm(prev => ({ ...prev, constructorArgs: e.target.value }))}
            description="Comma-separated constructor arguments used when deploying"
            minRows={2}
          />
          
          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              onClick={() => {
                setVerifyModalOpened(false);
                setVerifyForm({ contractAddress: '', constructorArgs: '', contractName: '' });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleVerifyContract}
              disabled={!verifyForm.contractAddress || isManaging}
              loading={isManaging}
              leftSection="🔍"
            >
              Verify Contract
            </Button>
          </Group>
        </Stack>
      </Modal>

      <AppShell
        header={{ height: 60 }}
        navbar={{ width: 300, breakpoint: 'sm', collapsed: { mobile: !opened } }}
        padding="md"
      >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={1} c="orange">🔨 Hardhat GUI</Title>
          </Group>
          <Group>
            <ThemeToggle />
            <Button 
              onClick={toggleAutoRefresh} 
              leftSection={autoRefresh ? "⏸️" : "🔄"} 
              size="sm"
              variant={autoRefresh ? "filled" : "default"}
              color={autoRefresh ? "green" : undefined}
            >
              {autoRefresh ? "Auto" : "Manual"}
            </Button>
            <Button onClick={handleRefresh} leftSection="🔄" size="sm" variant="subtle">
              Refresh
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Stack gap="xs">
          <NavLink
            label="Hardhat Management"
            leftSection="🔨"
            active={activeSection === 'management'}
            onClick={() => setActiveSection('management')}
            variant="filled"
          />
          <NavLink
            label="Network Information"
            leftSection="📡"
            active={activeSection === 'network'}
            onClick={() => setActiveSection('network')}
            variant="filled"
          />
          <NavLink
            label="Local Accounts"
            leftSection="💰"
            active={activeSection === 'accounts'}
            onClick={() => setActiveSection('accounts')}
            variant="filled"
          />
          <NavLink
            label="Smart Contracts"
            leftSection="📋"
            active={activeSection === 'contracts'}
            onClick={() => setActiveSection('contracts')}
            variant="filled"
          />
          <NavLink
            label="Transactions"
            leftSection="📜"
            active={activeSection === 'transactions'}
            onClick={() => setActiveSection('transactions')}
            variant="filled"
          />
          <NavLink
            label="Hardhat Console"
            leftSection="⚡"
            active={activeSection === 'console'}
            onClick={() => setActiveSection('console')}
            variant="filled"
          />
        </Stack>
      </AppShell.Navbar>

      <AppShell.Main>
        <Stack gap="md">
          {error && (
            <Alert variant="light" color="red" title="Error" withCloseButton onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {renderCurrentSection()}

          <Text ta="center" c="dimmed" size="sm" mt="md">
            🚀 Built with Tauri + React + Mantine
          </Text>
        </Stack>
      </AppShell.Main>
    </AppShell>
    </>
  );
}

function App() {
  return (
    <>
      <ColorSchemeScript />
      <MantineProvider defaultColorScheme="auto">
        <Notifications />
        <HardhatApp />
      </MantineProvider>
    </>
  );
}

export default App;

#!/usr/bin/env node
/**
 * Docker Swarm Manager Script
 * Manages Swarm initialization, deployment, scaling, and monitoring
 *
 * Usage:
 *   node scripts/swarm-manager.js init          # Initialize Swarm cluster
 *   node scripts/swarm-manager.js build         # Build and push images
 *   node scripts/swarm-manager.js deploy        # Deploy stack
 *   node scripts/swarm-manager.js scale <service> <replicas>
 *   node scripts/swarm-manager.js status        # Show stack status
 *   node scripts/swarm-manager.js logs <service>
 *   node scripts/swarm-manager.js remove        # Remove stack
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Resolve ROOT_DIR - find project root by looking for config.json
const findProjectRoot = () => {
  let current = process.cwd();
  while (current !== '/') {
    if (fs.existsSync(path.join(current, 'config.json')) ||
        fs.existsSync(path.join(current, 'package.json'))) {
      return current;
    }
    current = path.dirname(current);
  }
  return process.cwd();
};
const ROOT_DIR = findProjectRoot();

const CONFIG_PATH = path.join(ROOT_DIR, 'config.json');
const SWARM_COMPOSE = path.join(ROOT_DIR, 'docker-compose.swarm.yml');

/**
 * Load configuration
 */
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('Error: config.json not found.');
    console.error('Run "node scripts/docker-setup.js --init" to create one.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

/**
 * Execute command and return output
 */
function exec(cmd, options = {}) {
  try {
    return execSync(cmd, {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
  } catch (error) {
    if (!options.ignoreError) {
      console.error(`Command failed: ${cmd}`);
      process.exit(1);
    }
    return null;
  }
}

/**
 * Check if Swarm is initialized
 */
function isSwarmActive() {
  try {
    const result = execSync('docker info --format "{{.Swarm.LocalNodeState}}"', {
      encoding: 'utf8',
      stdio: 'pipe'
    }).trim();
    return result === 'active';
  } catch {
    return false;
  }
}

/**
 * Initialize Swarm cluster
 */
function initSwarm() {
  console.log('Initializing Docker Swarm...\n');

  if (isSwarmActive()) {
    console.log('Swarm is already active.');
    exec('docker node ls');
    return;
  }

  // Get advertise address
  const config = loadConfig();
  const advertiseAddr = config.network?.externalHost || '0.0.0.0';

  console.log(`Initializing Swarm with advertise address: ${advertiseAddr}`);
  exec(`docker swarm init --advertise-addr ${advertiseAddr}`);

  console.log('\nSwarm initialized successfully!');
  console.log('\nTo add worker nodes, run this command on other machines:');
  exec('docker swarm join-token worker');
}

/**
 * Build and push images to registry
 */
function buildImages() {
  const config = loadConfig();
  const registryUrl = config.swarm?.registry?.url || '127.0.0.1:5000';
  const imageTag = config.swarm?.imageTag || 'latest';

  console.log('Building and pushing Docker images...\n');

  // Check if local registry is running (for multi-node deployment)
  if (config.swarm?.registry?.useLocal) {
    try {
      execSync(`docker ps | grep registry`, { stdio: 'pipe' });
    } catch {
      console.log('Starting local registry...');
      exec('docker service create --name registry -p 5000:5000 registry:2', { ignoreError: true });
    }
  }

  // Build frontend
  console.log('\n--- Building Frontend ---');
  exec(`docker build -t ${registryUrl}/djsh-frontend:${imageTag} .`);

  // Build backend
  console.log('\n--- Building Backend ---');
  exec(`docker build -t ${registryUrl}/djsh-backend:${imageTag} ./backend`);

  // Push to registry (for multi-node)
  if (config.swarm?.registry?.useLocal) {
    console.log('\n--- Pushing to Registry ---');
    exec(`docker push ${registryUrl}/djsh-frontend:${imageTag}`, { ignoreError: true });
    exec(`docker push ${registryUrl}/djsh-backend:${imageTag}`, { ignoreError: true });
  }

  console.log('\nImages built successfully!');
  console.log(`  Frontend: ${registryUrl}/djsh-frontend:${imageTag}`);
  console.log(`  Backend:  ${registryUrl}/djsh-backend:${imageTag}`);
}

/**
 * Deploy stack to Swarm
 */
function deployStack() {
  const config = loadConfig();
  const stackName = config.swarm?.stackName || 'djsh';

  console.log(`Deploying stack "${stackName}" to Swarm...\n`);

  if (!isSwarmActive()) {
    console.error('Error: Swarm is not active.');
    console.error('Run "node scripts/swarm-manager.js init" first.');
    process.exit(1);
  }

  // Generate .env file
  console.log('Generating .env file...');
  exec('node scripts/docker-setup.js', { silent: true });

  // Deploy stack
  exec(`docker stack deploy -c ${SWARM_COMPOSE} ${stackName}`);

  console.log('\nStack deployed! Waiting for services to start...\n');

  // Wait and show status
  setTimeout(() => {
    exec(`docker stack services ${stackName}`);
    console.log('\nUse "node scripts/swarm-manager.js status" to check deployment status.');
  }, 3000);
}

/**
 * Scale a service
 */
function scaleService(service, replicas) {
  const config = loadConfig();
  const stackName = config.swarm?.stackName || 'djsh';
  const fullServiceName = `${stackName}_${service}`;

  console.log(`Scaling ${fullServiceName} to ${replicas} replicas...\n`);

  exec(`docker service scale ${fullServiceName}=${replicas}`);

  console.log('\nService scaled. Current status:');
  exec(`docker service ps ${fullServiceName}`);
}

/**
 * Show stack status
 */
function showStatus() {
  const config = loadConfig();
  const stackName = config.swarm?.stackName || 'djsh';

  console.log(`Stack "${stackName}" Status\n`);
  console.log('========================================');

  if (!isSwarmActive()) {
    console.log('Swarm Status: INACTIVE');
    console.log('\nRun "node scripts/swarm-manager.js init" to initialize Swarm.');
    return;
  }

  console.log('Swarm Status: ACTIVE\n');

  // Show nodes
  console.log('--- Nodes ---');
  exec('docker node ls');

  // Check if stack exists
  try {
    console.log('\n--- Services ---');
    exec(`docker stack services ${stackName}`);

    console.log('\n--- Tasks ---');
    exec(`docker stack ps ${stackName} --format "table {{.Name}}\t{{.Image}}\t{{.Node}}\t{{.CurrentState}}\t{{.Error}}"`);
  } catch {
    console.log(`Stack "${stackName}" is not deployed.`);
    console.log('Run "node scripts/swarm-manager.js deploy" to deploy.');
  }

  // Show published ports
  console.log('\n--- Published Ports ---');
  console.log(`  Frontend: ${config.docker?.externalPorts?.frontend || 3000}`);
  console.log(`  Backend:  ${config.docker?.externalPorts?.backend || 8080}`);
  console.log(`  MySQL:    ${config.docker?.externalPorts?.mysql || 3306}`);
}

/**
 * Show service logs
 */
function showLogs(service) {
  const config = loadConfig();
  const stackName = config.swarm?.stackName || 'djsh';
  const fullServiceName = `${stackName}_${service}`;

  console.log(`Logs for ${fullServiceName}...\n`);

  // Use spawn for streaming logs
  const logs = spawn('docker', ['service', 'logs', '-f', '--tail', '100', fullServiceName], {
    stdio: 'inherit'
  });

  logs.on('error', (err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}

/**
 * Remove stack
 */
function removeStack() {
  const config = loadConfig();
  const stackName = config.swarm?.stackName || 'djsh';

  console.log(`Removing stack "${stackName}"...\n`);

  exec(`docker stack rm ${stackName}`);

  console.log('\nStack removed. Waiting for cleanup...');
  setTimeout(() => {
    console.log('\nRemaining resources:');
    exec('docker network ls | grep djsh', { ignoreError: true });
    exec('docker volume ls | grep djsh', { ignoreError: true });
  }, 5000);
}

/**
 * Rolling update
 */
function updateService(service) {
  const config = loadConfig();
  const stackName = config.swarm?.stackName || 'djsh';
  const fullServiceName = `${stackName}_${service}`;
  const registryUrl = config.swarm?.registry?.url || '127.0.0.1:5000';
  const imageTag = config.swarm?.imageTag || 'latest';

  console.log(`Updating ${fullServiceName}...\n`);

  // Rebuild image
  if (service === 'frontend') {
    exec(`docker build -t ${registryUrl}/djsh-frontend:${imageTag} .`);
  } else if (service === 'backend') {
    exec(`docker build -t ${registryUrl}/djsh-backend:${imageTag} ./backend`);
  }

  // Force update
  exec(`docker service update --force ${fullServiceName}`);

  console.log('\nUpdate initiated. Checking status...');
  setTimeout(() => {
    exec(`docker service ps ${fullServiceName}`);
  }, 2000);
}

/**
 * Show help
 */
function showHelp() {
  console.log(`
Docker Swarm Manager - Manage DJSH Swarm Deployment

Usage:
  node scripts/swarm-manager.js <command> [options]

Commands:
  init                    Initialize Docker Swarm cluster
  build                   Build and push Docker images
  deploy                  Deploy stack to Swarm
  status                  Show stack and service status
  scale <service> <n>     Scale a service to n replicas
  update <service>        Rolling update a service
  logs <service>          Show service logs (streaming)
  remove                  Remove stack from Swarm

Services:
  frontend, backend, mysql

Examples:
  node scripts/swarm-manager.js init
  node scripts/swarm-manager.js build
  node scripts/swarm-manager.js deploy
  node scripts/swarm-manager.js scale backend 3
  node scripts/swarm-manager.js logs frontend
  node scripts/swarm-manager.js update backend
  node scripts/swarm-manager.js status
  node scripts/swarm-manager.js remove

Full Deployment Flow:
  1. node scripts/docker-setup.js --init    # First time only
  2. node scripts/swarm-manager.js init     # Initialize Swarm
  3. node scripts/swarm-manager.js build    # Build images
  4. node scripts/swarm-manager.js deploy   # Deploy stack
`);
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'init':
      initSwarm();
      break;
    case 'build':
      buildImages();
      break;
    case 'deploy':
      deployStack();
      break;
    case 'status':
      showStatus();
      break;
    case 'scale':
      if (args.length < 3) {
        console.error('Usage: swarm-manager.js scale <service> <replicas>');
        process.exit(1);
      }
      scaleService(args[1], parseInt(args[2]));
      break;
    case 'update':
      if (args.length < 2) {
        console.error('Usage: swarm-manager.js update <service>');
        process.exit(1);
      }
      updateService(args[1]);
      break;
    case 'logs':
      if (args.length < 2) {
        console.error('Usage: swarm-manager.js logs <service>');
        process.exit(1);
      }
      showLogs(args[1]);
      break;
    case 'remove':
      removeStack();
      break;
    case 'help':
    case '--help':
    case '-h':
    default:
      showHelp();
      break;
  }
}

main();

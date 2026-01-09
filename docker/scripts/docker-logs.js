#!/usr/bin/env node
/**
 * Docker Logs Management Script
 *
 * Features:
 * - Monitor container health status
 * - Collect and aggregate logs from all services
 * - Filter and highlight errors
 * - Export logs to files
 * - Real-time log streaming
 * - Status reporting with error tracking
 *
 * Usage:
 *   node scripts/docker-logs.js status    # Show container status and health
 *   node scripts/docker-logs.js logs      # Stream all logs
 *   node scripts/docker-logs.js logs backend   # Stream specific service logs
 *   node scripts/docker-logs.js errors    # Show only errors
 *   node scripts/docker-logs.js export    # Export logs to files
 *   node scripts/docker-logs.js watch     # Watch mode with auto-refresh
 *   node scripts/docker-logs.js report    # Generate status report
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
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

const LOGS_DIR = path.join(ROOT_DIR, 'docker/volumes/logs');
const CONFIG_FILE = path.join(ROOT_DIR, 'config.json');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m'
};

// Service colors for log output
const serviceColors = {
  mysql: colors.cyan,
  backend: colors.green,
  frontend: colors.magenta
};

/**
 * Load configuration from config.json
 */
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (error) {
    console.warn(`${colors.yellow}Warning: Could not load config.json${colors.reset}`);
  }
  return {};
}

/**
 * Execute command and return output
 */
function exec(cmd, options = {}) {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      cwd: ROOT_DIR,
      ...options
    });
  } catch (error) {
    if (options.silent) {
      return error.stdout || '';
    }
    throw error;
  }
}

/**
 * Get container status with health information
 */
function getContainerStatus() {
  const containers = [];
  const format = '{{.Names}}\t{{.Status}}\t{{.State}}\t{{.Image}}';

  try {
    const output = exec(
      `docker compose ps --format "${format}" 2>/dev/null`,
      { silent: true, stdio: 'pipe' }
    );

    const lines = output.trim().split('\n').filter(Boolean);

    for (const line of lines) {
      const [name, status, state, image] = line.split('\t');

      // Get detailed health status
      let healthStatus = 'N/A';
      let healthLog = '';
      try {
        const healthJson = exec(
          `docker inspect --format='{{json .State.Health}}' ${name} 2>/dev/null`,
          { silent: true, stdio: 'pipe' }
        ).trim();

        if (healthJson && healthJson !== 'null') {
          const health = JSON.parse(healthJson);
          healthStatus = health.Status || 'N/A';
          if (health.Log && health.Log.length > 0) {
            const lastLog = health.Log[health.Log.length - 1];
            if (lastLog.ExitCode !== 0) {
              healthLog = lastLog.Output || '';
            }
          }
        }
      } catch (e) {
        // Container might not have health check
      }

      // Get restart count
      let restartCount = 0;
      try {
        restartCount = parseInt(exec(
          `docker inspect --format='{{.RestartCount}}' ${name} 2>/dev/null`,
          { silent: true, stdio: 'pipe' }
        ).trim()) || 0;
      } catch (e) {}

      // Get last error from logs
      let lastError = '';
      try {
        const errorLogs = exec(
          `docker logs ${name} --tail 50 2>&1 | grep -iE "(error|exception|failed|fatal)" | tail -1`,
          { silent: true, stdio: 'pipe' }
        ).trim();
        if (errorLogs) {
          lastError = errorLogs.substring(0, 100);
        }
      } catch (e) {}

      containers.push({
        name,
        status,
        state,
        image,
        healthStatus,
        healthLog,
        restartCount,
        lastError
      });
    }
  } catch (error) {
    console.error(`${colors.red}Error getting container status: ${error.message}${colors.reset}`);
  }

  return containers;
}

/**
 * Display container status
 */
function showStatus() {
  console.log(`\n${colors.bright}${colors.blue}=== Docker Compose Status ===${colors.reset}\n`);

  const containers = getContainerStatus();

  if (containers.length === 0) {
    console.log(`${colors.yellow}No containers running. Start with: docker compose up -d${colors.reset}`);
    return;
  }

  for (const container of containers) {
    const stateIcon = container.state === 'running' ? `${colors.green}●${colors.reset}` : `${colors.red}○${colors.reset}`;
    const healthIcon = getHealthIcon(container.healthStatus);

    console.log(`${stateIcon} ${colors.bright}${container.name}${colors.reset}`);
    console.log(`  State: ${container.state} | Health: ${healthIcon} ${container.healthStatus}`);
    console.log(`  Status: ${container.status}`);
    console.log(`  Restarts: ${container.restartCount}`);

    if (container.lastError) {
      console.log(`  ${colors.red}Last Error: ${container.lastError}${colors.reset}`);
    }
    if (container.healthLog) {
      console.log(`  ${colors.yellow}Health Log: ${container.healthLog.substring(0, 80)}${colors.reset}`);
    }
    console.log();
  }

  // Summary
  const healthy = containers.filter(c => c.healthStatus === 'healthy').length;
  const unhealthy = containers.filter(c => c.healthStatus === 'unhealthy').length;
  const starting = containers.filter(c => c.healthStatus === 'starting').length;

  console.log(`${colors.dim}Summary: ${healthy} healthy, ${starting} starting, ${unhealthy} unhealthy${colors.reset}`);
}

/**
 * Get health status icon
 */
function getHealthIcon(status) {
  switch (status) {
    case 'healthy': return `${colors.green}✓${colors.reset}`;
    case 'unhealthy': return `${colors.red}✗${colors.reset}`;
    case 'starting': return `${colors.yellow}◐${colors.reset}`;
    default: return `${colors.dim}-${colors.reset}`;
  }
}

/**
 * Stream logs from containers
 */
function streamLogs(service = null, options = {}) {
  const args = ['compose', 'logs', '-f', '--tail', options.tail || '100'];

  if (options.timestamps) {
    args.push('-t');
  }

  if (service) {
    args.push(service);
  }

  console.log(`${colors.dim}Streaming logs... (Ctrl+C to stop)${colors.reset}\n`);

  const proc = spawn('docker', args, {
    cwd: ROOT_DIR,
    stdio: 'inherit'
  });

  proc.on('error', (error) => {
    console.error(`${colors.red}Error streaming logs: ${error.message}${colors.reset}`);
  });

  return proc;
}

/**
 * Show only error logs
 */
function showErrors(service = null) {
  console.log(`\n${colors.bright}${colors.red}=== Error Logs ===${colors.reset}\n`);

  const services = service ? [service] : ['mysql', 'backend', 'frontend'];

  for (const svc of services) {
    const svcColor = serviceColors[svc] || colors.white;
    console.log(`${svcColor}${colors.bright}--- ${svc} ---${colors.reset}`);

    try {
      const errors = exec(
        `docker compose logs ${svc} --tail 500 2>&1 | grep -iE "(error|exception|failed|fatal|panic|critical)" || true`,
        { silent: true, stdio: 'pipe' }
      );

      if (errors.trim()) {
        // Highlight error keywords
        const highlighted = errors
          .split('\n')
          .map(line => highlightErrors(line))
          .join('\n');
        console.log(highlighted);
      } else {
        console.log(`${colors.green}No errors found${colors.reset}`);
      }
    } catch (e) {
      console.log(`${colors.yellow}Could not retrieve logs${colors.reset}`);
    }
    console.log();
  }
}

/**
 * Highlight error keywords in log line
 */
function highlightErrors(line) {
  return line
    .replace(/(error|exception|fatal|panic|critical)/gi, `${colors.bgRed}${colors.white}$1${colors.reset}`)
    .replace(/(failed)/gi, `${colors.red}$1${colors.reset}`)
    .replace(/(warning|warn)/gi, `${colors.yellow}$1${colors.reset}`);
}

/**
 * Export logs to files
 */
function exportLogs(options = {}) {
  // Create logs directory
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const services = ['mysql', 'backend', 'frontend'];

  console.log(`\n${colors.bright}Exporting logs to ${LOGS_DIR}${colors.reset}\n`);

  for (const service of services) {
    const logFile = path.join(LOGS_DIR, `${service}-${timestamp}.log`);

    try {
      const logs = exec(
        `docker compose logs ${service} --no-color ${options.since ? `--since ${options.since}` : ''} 2>&1`,
        { silent: true, stdio: 'pipe' }
      );

      fs.writeFileSync(logFile, logs);
      const size = (fs.statSync(logFile).size / 1024).toFixed(2);
      console.log(`${colors.green}✓${colors.reset} ${service}: ${logFile} (${size} KB)`);
    } catch (error) {
      console.log(`${colors.red}✗${colors.reset} ${service}: Failed to export`);
    }
  }

  // Export combined logs
  const combinedFile = path.join(LOGS_DIR, `combined-${timestamp}.log`);
  try {
    const combinedLogs = exec(
      `docker compose logs --no-color ${options.since ? `--since ${options.since}` : ''} 2>&1`,
      { silent: true, stdio: 'pipe' }
    );
    fs.writeFileSync(combinedFile, combinedLogs);
    const size = (fs.statSync(combinedFile).size / 1024).toFixed(2);
    console.log(`${colors.green}✓${colors.reset} combined: ${combinedFile} (${size} KB)`);
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset} combined: Failed to export`);
  }

  // Generate error summary
  const errorFile = path.join(LOGS_DIR, `errors-${timestamp}.log`);
  try {
    let errorContent = `Error Summary - ${new Date().toISOString()}\n${'='.repeat(60)}\n\n`;

    for (const service of services) {
      errorContent += `[${service.toUpperCase()}]\n`;
      const errors = exec(
        `docker compose logs ${service} --no-color 2>&1 | grep -iE "(error|exception|failed|fatal)" || true`,
        { silent: true, stdio: 'pipe' }
      );
      errorContent += errors || 'No errors found\n';
      errorContent += '\n';
    }

    fs.writeFileSync(errorFile, errorContent);
    console.log(`${colors.green}✓${colors.reset} errors: ${errorFile}`);
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset} errors: Failed to generate`);
  }

  console.log(`\n${colors.dim}Logs exported successfully${colors.reset}`);
}

/**
 * Watch mode - auto refresh status
 */
function watchMode(interval = 5000) {
  console.clear();
  console.log(`${colors.dim}Watch mode (refresh every ${interval/1000}s, Ctrl+C to stop)${colors.reset}`);

  const update = () => {
    console.clear();
    console.log(`${colors.dim}Watch mode (refresh every ${interval/1000}s, Ctrl+C to stop)${colors.reset}`);
    console.log(`${colors.dim}Last update: ${new Date().toLocaleTimeString()}${colors.reset}`);
    showStatus();
  };

  update();
  const timer = setInterval(update, interval);

  process.on('SIGINT', () => {
    clearInterval(timer);
    console.log('\n');
    process.exit(0);
  });
}

/**
 * Generate comprehensive status report
 */
function generateReport() {
  const timestamp = new Date().toISOString();
  const containers = getContainerStatus();

  console.log(`\n${colors.bright}${colors.blue}╔══════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}║          Docker Compose Status Report                    ║${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}╚══════════════════════════════════════════════════════════╝${colors.reset}\n`);

  console.log(`${colors.dim}Generated: ${timestamp}${colors.reset}\n`);

  // Overall Status
  const allHealthy = containers.every(c => c.healthStatus === 'healthy');
  const hasErrors = containers.some(c => c.lastError || c.healthStatus === 'unhealthy');

  if (allHealthy) {
    console.log(`${colors.green}${colors.bright}Overall Status: ✓ All services healthy${colors.reset}\n`);
  } else if (hasErrors) {
    console.log(`${colors.red}${colors.bright}Overall Status: ✗ Issues detected${colors.reset}\n`);
  } else {
    console.log(`${colors.yellow}${colors.bright}Overall Status: ◐ Services starting${colors.reset}\n`);
  }

  // Service Details
  console.log(`${colors.bright}Service Details:${colors.reset}`);
  console.log(`${'─'.repeat(60)}`);

  for (const container of containers) {
    const statusColor = container.healthStatus === 'healthy' ? colors.green :
                       container.healthStatus === 'unhealthy' ? colors.red : colors.yellow;

    console.log(`\n${colors.bright}${container.name}${colors.reset}`);
    console.log(`  Status:     ${statusColor}${container.state}${colors.reset}`);
    console.log(`  Health:     ${statusColor}${container.healthStatus}${colors.reset}`);
    console.log(`  Uptime:     ${container.status}`);
    console.log(`  Restarts:   ${container.restartCount > 0 ? colors.yellow : ''}${container.restartCount}${colors.reset}`);

    if (container.lastError) {
      console.log(`  Last Error: ${colors.red}${container.lastError}${colors.reset}`);
    }
  }

  // Resource Usage
  console.log(`\n${colors.bright}Resource Usage:${colors.reset}`);
  console.log(`${'─'.repeat(60)}`);

  try {
    const stats = exec(
      `docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" 2>/dev/null`,
      { silent: true, stdio: 'pipe' }
    );
    console.log(stats);
  } catch (e) {
    console.log(`${colors.dim}Unable to retrieve resource stats${colors.reset}`);
  }

  // Recent Errors
  console.log(`\n${colors.bright}Recent Errors (last 10):${colors.reset}`);
  console.log(`${'─'.repeat(60)}`);

  let errorCount = 0;
  for (const container of containers) {
    try {
      const errors = exec(
        `docker logs ${container.name} --tail 100 2>&1 | grep -iE "(error|exception|failed|fatal)" | tail -3`,
        { silent: true, stdio: 'pipe' }
      ).trim();

      if (errors) {
        console.log(`\n${colors.yellow}[${container.name}]${colors.reset}`);
        console.log(errors);
        errorCount += errors.split('\n').length;
      }
    } catch (e) {}
  }

  if (errorCount === 0) {
    console.log(`${colors.green}No recent errors found${colors.reset}`);
  }

  // Recommendations
  console.log(`\n${colors.bright}Recommendations:${colors.reset}`);
  console.log(`${'─'.repeat(60)}`);

  const recommendations = [];

  for (const container of containers) {
    if (container.healthStatus === 'unhealthy') {
      recommendations.push(`${colors.red}●${colors.reset} ${container.name} is unhealthy - check logs with: docker logs ${container.name}`);
    }
    if (container.restartCount > 3) {
      recommendations.push(`${colors.yellow}●${colors.reset} ${container.name} has restarted ${container.restartCount} times - investigate stability issues`);
    }
  }

  if (recommendations.length === 0) {
    console.log(`${colors.green}No issues detected${colors.reset}`);
  } else {
    recommendations.forEach(r => console.log(r));
  }

  console.log();
}

/**
 * Show log statistics
 */
function showLogStats() {
  console.log(`\n${colors.bright}Log Statistics:${colors.reset}\n`);

  const services = ['mysql', 'backend', 'frontend'];

  for (const service of services) {
    const svcColor = serviceColors[service] || colors.white;

    try {
      // Count total lines
      const totalLines = exec(
        `docker compose logs ${service} 2>&1 | wc -l`,
        { silent: true, stdio: 'pipe' }
      ).trim();

      // Count errors
      const errorCount = exec(
        `docker compose logs ${service} 2>&1 | grep -ciE "(error|exception|failed|fatal)" || echo 0`,
        { silent: true, stdio: 'pipe' }
      ).trim();

      // Count warnings
      const warnCount = exec(
        `docker compose logs ${service} 2>&1 | grep -ciE "(warning|warn)" || echo 0`,
        { silent: true, stdio: 'pipe' }
      ).trim();

      console.log(`${svcColor}${service}:${colors.reset}`);
      console.log(`  Total lines:  ${totalLines}`);
      console.log(`  Errors:       ${parseInt(errorCount) > 0 ? colors.red : ''}${errorCount}${colors.reset}`);
      console.log(`  Warnings:     ${parseInt(warnCount) > 0 ? colors.yellow : ''}${warnCount}${colors.reset}`);
      console.log();
    } catch (e) {
      console.log(`${svcColor}${service}:${colors.reset} ${colors.dim}Unable to get stats${colors.reset}\n`);
    }
  }
}

/**
 * Print usage information
 */
function printUsage() {
  console.log(`
${colors.bright}Docker Logs Management${colors.reset}

${colors.cyan}Usage:${colors.reset}
  node scripts/docker-logs.js <command> [options]

${colors.cyan}Commands:${colors.reset}
  ${colors.green}status${colors.reset}              Show container status and health
  ${colors.green}logs${colors.reset} [service]     Stream logs (optionally for specific service)
  ${colors.green}errors${colors.reset} [service]   Show only error logs
  ${colors.green}export${colors.reset}             Export all logs to files
  ${colors.green}watch${colors.reset}              Watch mode with auto-refresh status
  ${colors.green}report${colors.reset}             Generate comprehensive status report
  ${colors.green}stats${colors.reset}              Show log statistics

${colors.cyan}Options:${colors.reset}
  --tail <n>          Number of lines to show (default: 100)
  --since <time>      Show logs since timestamp (e.g., 1h, 30m, 2024-01-01)
  -t, --timestamps    Show timestamps in logs

${colors.cyan}Examples:${colors.reset}
  node scripts/docker-logs.js status
  node scripts/docker-logs.js logs backend
  node scripts/docker-logs.js errors
  node scripts/docker-logs.js export --since 1h
  node scripts/docker-logs.js watch
`);
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    command: args[0] || 'status',
    service: null,
    tail: '100',
    since: null,
    timestamps: false
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--tail' && args[i + 1]) {
      options.tail = args[++i];
    } else if (arg === '--since' && args[i + 1]) {
      options.since = args[++i];
    } else if (arg === '-t' || arg === '--timestamps') {
      options.timestamps = true;
    } else if (!arg.startsWith('-')) {
      options.service = arg;
    }
  }

  return options;
}

/**
 * Main entry point
 */
function main() {
  const options = parseArgs();

  switch (options.command) {
    case 'status':
      showStatus();
      break;

    case 'logs':
      streamLogs(options.service, options);
      break;

    case 'errors':
      showErrors(options.service);
      break;

    case 'export':
      exportLogs(options);
      break;

    case 'watch':
      watchMode();
      break;

    case 'report':
      generateReport();
      break;

    case 'stats':
      showLogStats();
      break;

    case 'help':
    case '--help':
    case '-h':
      printUsage();
      break;

    default:
      console.log(`${colors.red}Unknown command: ${options.command}${colors.reset}`);
      printUsage();
      process.exit(1);
  }
}

main();

#!/usr/bin/env node
/**
 * Docker Volume Backup & Restore Script
 * For migrating DJSH data to new machines
 *
 * Usage:
 *   node scripts/volume-backup.js backup              # Backup all volumes
 *   node scripts/volume-backup.js backup mysql        # Backup MySQL volume only
 *   node scripts/volume-backup.js restore <file>      # Restore from backup
 *   node scripts/volume-backup.js list                # List available backups
 *   node scripts/volume-backup.js export              # Export for migration (tar.gz)
 *   node scripts/volume-backup.js import <file>       # Import on new machine
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(ROOT_DIR, 'backups');
const CONFIG_PATH = path.join(ROOT_DIR, 'config.json');

/**
 * Load configuration
 */
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('Error: config.json not found.');
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
      if (error.stderr) console.error(error.stderr);
      process.exit(1);
    }
    return null;
  }
}

/**
 * Get timestamp for backup filename
 */
function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

/**
 * Ensure backup directory exists
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`Created backup directory: ${BACKUP_DIR}`);
  }
}

/**
 * Get volume name from config
 */
function getVolumeName() {
  const config = loadConfig();
  return config.docker?.volumes?.mysql || 'djsh-mysql-data';
}

/**
 * Check if containers are running
 */
function isContainerRunning(name) {
  try {
    const result = execSync(`docker ps --filter "name=${name}" --format "{{.Names}}"`, {
      encoding: 'utf8',
      stdio: 'pipe'
    }).trim();
    return result.includes(name);
  } catch {
    return false;
  }
}

/**
 * Backup MySQL volume
 */
function backupVolume(volumeType = 'mysql') {
  ensureBackupDir();

  const volumeName = getVolumeName();
  const timestamp = getTimestamp();
  const backupFile = `${volumeType}-backup-${timestamp}.tar.gz`;
  const backupPath = path.join(BACKUP_DIR, backupFile);

  console.log(`\nBacking up volume: ${volumeName}`);
  console.log(`Backup file: ${backupFile}\n`);

  // Check if MySQL container is running - warn about consistency
  if (isContainerRunning('djsh-mysql')) {
    console.log('Warning: MySQL container is running.');
    console.log('For consistent backup, consider stopping the container first:');
    console.log('  docker compose stop mysql\n');
  }

  // Create backup using a temporary container
  // This mounts the volume and creates a tar archive
  const cmd = `docker run --rm \
    -v ${volumeName}:/data:ro \
    -v "${BACKUP_DIR}":/backup \
    alpine:latest \
    tar -czf /backup/${backupFile} -C /data .`;

  console.log('Creating backup...');
  exec(cmd);

  // Get backup file size
  const stats = fs.statSync(backupPath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

  console.log(`\nBackup completed successfully!`);
  console.log(`  File: ${backupPath}`);
  console.log(`  Size: ${sizeMB} MB`);

  return backupPath;
}

/**
 * Restore volume from backup
 */
function restoreVolume(backupFile) {
  const volumeName = getVolumeName();
  const backupPath = path.isAbsolute(backupFile)
    ? backupFile
    : path.join(BACKUP_DIR, backupFile);

  if (!fs.existsSync(backupPath)) {
    console.error(`Error: Backup file not found: ${backupPath}`);
    process.exit(1);
  }

  console.log(`\nRestoring volume: ${volumeName}`);
  console.log(`From backup: ${backupPath}\n`);

  // Check if containers are running
  if (isContainerRunning('djsh-mysql')) {
    console.error('Error: MySQL container is running.');
    console.error('Stop all containers before restoring:');
    console.error('  docker compose down');
    process.exit(1);
  }

  // Check if volume exists
  try {
    execSync(`docker volume inspect ${volumeName}`, { stdio: 'pipe' });
    console.log(`Volume ${volumeName} exists. Data will be overwritten.`);
  } catch {
    console.log(`Creating volume: ${volumeName}`);
    exec(`docker volume create ${volumeName}`);
  }

  // Restore from backup
  const backupDir = path.dirname(backupPath);
  const backupName = path.basename(backupPath);

  const cmd = `docker run --rm \
    -v ${volumeName}:/data \
    -v "${backupDir}":/backup:ro \
    alpine:latest \
    sh -c "rm -rf /data/* && tar -xzf /backup/${backupName} -C /data"`;

  console.log('Restoring data...');
  exec(cmd);

  console.log(`\nRestore completed successfully!`);
  console.log('Start containers with: docker compose up -d');
}

/**
 * List available backups
 */
function listBackups() {
  ensureBackupDir();

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.tar.gz'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log('No backups found.');
    return;
  }

  console.log('\nAvailable backups:\n');
  console.log('  File Name                              Size       Date');
  console.log('  ' + '-'.repeat(70));

  files.forEach(file => {
    const filePath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2).padStart(8);
    const date = stats.mtime.toISOString().slice(0, 19).replace('T', ' ');
    console.log(`  ${file.padEnd(40)} ${sizeMB} MB   ${date}`);
  });

  console.log(`\nBackup directory: ${BACKUP_DIR}`);
}

/**
 * Export complete migration package
 * Includes: volume backup, config.json, secrets
 */
function exportMigration() {
  ensureBackupDir();

  const timestamp = getTimestamp();
  const exportDir = path.join(BACKUP_DIR, `migration-${timestamp}`);
  const exportFile = path.join(BACKUP_DIR, `djsh-migration-${timestamp}.tar.gz`);

  console.log('\nCreating migration package...\n');

  // Create temporary export directory
  fs.mkdirSync(exportDir, { recursive: true });

  // 1. Backup volume
  console.log('1. Backing up MySQL volume...');
  const volumeName = getVolumeName();
  const volumeBackup = 'mysql-data.tar.gz';

  exec(`docker run --rm \
    -v ${volumeName}:/data:ro \
    -v "${exportDir}":/backup \
    alpine:latest \
    tar -czf /backup/${volumeBackup} -C /data .`, { silent: true });

  // 2. Copy config.json (without sensitive data for template)
  console.log('2. Copying configuration template...');
  const config = loadConfig();
  const templateConfig = JSON.parse(JSON.stringify(config));
  // Clear sensitive data - user must regenerate on new machine
  templateConfig.database.password = '<regenerate-on-new-machine>';
  templateConfig.database.rootPassword = '<regenerate-on-new-machine>';
  templateConfig.jwt.accessSecret = '<regenerate-on-new-machine>';
  templateConfig.jwt.refreshSecret = '<regenerate-on-new-machine>';
  fs.writeFileSync(
    path.join(exportDir, 'config.template.json'),
    JSON.stringify(templateConfig, null, 2)
  );

  // 3. Create migration instructions
  console.log('3. Creating migration instructions...');
  const instructions = `# DJSH Migration Guide

## Migration Package Contents
- mysql-data.tar.gz: MySQL database backup
- config.template.json: Configuration template (secrets cleared)

## Steps to Restore on New Machine

### 1. Install Prerequisites
\`\`\`bash
# Install Docker and Docker Compose
# Clone or copy the DJSH project to the new machine
\`\`\`

### 2. Extract Migration Package
\`\`\`bash
tar -xzf djsh-migration-${timestamp}.tar.gz
cd migration-${timestamp}
\`\`\`

### 3. Setup Configuration
\`\`\`bash
# Copy template to project root
cp config.template.json /path/to/djsh/config.json

# Generate new secrets (IMPORTANT: this creates new passwords)
cd /path/to/djsh
node scripts/docker-setup.js --init --force

# Or manually edit config.json with your desired passwords
\`\`\`

### 4. Restore Database Volume
\`\`\`bash
# Create volume
docker volume create djsh-mysql-data

# Restore data
docker run --rm \\
  -v djsh-mysql-data:/data \\
  -v "$(pwd)":/backup:ro \\
  alpine:latest \\
  sh -c "rm -rf /data/* && tar -xzf /backup/mysql-data.tar.gz -C /data"
\`\`\`

### 5. Update MySQL Passwords in Database
\`\`\`bash
# Start MySQL only
docker compose up -d mysql

# Wait for MySQL to be ready
docker compose exec mysql mysqladmin ping -h 127.0.0.1 --wait

# Update user password to match new config
docker compose exec mysql mysql -u root -p<OLD_ROOT_PASSWORD> -e "
  ALTER USER 'djsh_user'@'%' IDENTIFIED BY '<NEW_PASSWORD_FROM_CONFIG>';
  FLUSH PRIVILEGES;
"

# Or reset root password if needed
docker compose exec mysql mysql -u root -p<OLD_PASSWORD> -e "
  ALTER USER 'root'@'%' IDENTIFIED BY '<NEW_ROOT_PASSWORD>';
  ALTER USER 'root'@'localhost' IDENTIFIED BY '<NEW_ROOT_PASSWORD>';
  FLUSH PRIVILEGES;
"
\`\`\`

### 6. Start All Services
\`\`\`bash
docker compose up -d
docker compose ps
\`\`\`

## Important Notes
- Database passwords in the backup match the OLD machine's config
- You must update passwords in MySQL after restore if using new secrets
- Alternatively, copy the original secrets/ directory to keep the same passwords

## Verify Migration
\`\`\`bash
# Check all services are healthy
docker compose ps

# Test API
curl http://localhost:8080/lookups/version

# Test frontend
curl -I http://localhost:3000
\`\`\`
`;

  fs.writeFileSync(path.join(exportDir, 'MIGRATION.md'), instructions);

  // 4. Create final archive
  console.log('4. Creating migration archive...');
  exec(`tar -czf "${exportFile}" -C "${BACKUP_DIR}" "migration-${timestamp}"`, { silent: true });

  // 5. Cleanup temporary directory
  fs.rmSync(exportDir, { recursive: true });

  // Get file size
  const stats = fs.statSync(exportFile);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

  console.log(`\nMigration package created successfully!`);
  console.log(`  File: ${exportFile}`);
  console.log(`  Size: ${sizeMB} MB`);
  console.log(`\nTransfer this file to the new machine and follow MIGRATION.md instructions.`);

  return exportFile;
}

/**
 * Import migration package on new machine
 */
function importMigration(packageFile) {
  const packagePath = path.isAbsolute(packageFile)
    ? packageFile
    : path.resolve(process.cwd(), packageFile);

  if (!fs.existsSync(packagePath)) {
    console.error(`Error: Migration package not found: ${packagePath}`);
    process.exit(1);
  }

  console.log(`\nImporting migration package: ${packagePath}\n`);

  // Extract package
  ensureBackupDir();
  const extractDir = path.join(BACKUP_DIR, 'import-temp');

  if (fs.existsSync(extractDir)) {
    fs.rmSync(extractDir, { recursive: true });
  }
  fs.mkdirSync(extractDir, { recursive: true });

  exec(`tar -xzf "${packagePath}" -C "${extractDir}"`, { silent: true });

  // Find the migration directory
  const dirs = fs.readdirSync(extractDir).filter(d =>
    fs.statSync(path.join(extractDir, d)).isDirectory()
  );

  if (dirs.length === 0) {
    console.error('Error: Invalid migration package structure');
    process.exit(1);
  }

  const migrationDir = path.join(extractDir, dirs[0]);
  const volumeBackup = path.join(migrationDir, 'mysql-data.tar.gz');
  const configTemplate = path.join(migrationDir, 'config.template.json');
  const instructions = path.join(migrationDir, 'MIGRATION.md');

  console.log('Migration package contents:');
  if (fs.existsSync(volumeBackup)) console.log('  ✓ mysql-data.tar.gz');
  if (fs.existsSync(configTemplate)) console.log('  ✓ config.template.json');
  if (fs.existsSync(instructions)) console.log('  ✓ MIGRATION.md');

  // Copy config template if no config.json exists
  if (!fs.existsSync(CONFIG_PATH) && fs.existsSync(configTemplate)) {
    console.log('\nNo config.json found. Copying template...');
    fs.copyFileSync(configTemplate, CONFIG_PATH);
    console.log('Created config.json from template.');
    console.log('Run "node scripts/docker-setup.js --init --force" to generate secrets.');
  }

  // Restore volume
  if (fs.existsSync(volumeBackup)) {
    const volumeName = getVolumeName();

    // Check if containers are running
    if (isContainerRunning('djsh-mysql')) {
      console.error('\nError: MySQL container is running.');
      console.error('Stop all containers before importing:');
      console.error('  docker compose down');
      fs.rmSync(extractDir, { recursive: true });
      process.exit(1);
    }

    console.log(`\nRestoring MySQL volume: ${volumeName}`);

    // Ensure volume exists
    exec(`docker volume create ${volumeName}`, { ignoreError: true, silent: true });

    // Restore
    exec(`docker run --rm \
      -v ${volumeName}:/data \
      -v "${migrationDir}":/backup:ro \
      alpine:latest \
      sh -c "rm -rf /data/* && tar -xzf /backup/mysql-data.tar.gz -C /data"`, { silent: true });

    console.log('Volume restored successfully!');
  }

  // Cleanup
  fs.rmSync(extractDir, { recursive: true });

  console.log('\n' + '='.repeat(50));
  console.log('Import completed!');
  console.log('='.repeat(50));
  console.log('\nNext steps:');
  console.log('1. Generate secrets: node scripts/docker-setup.js --init --force');
  console.log('2. Start services: docker compose up -d');
  console.log('3. Update MySQL passwords (see MIGRATION.md in the package)');
}

/**
 * Show help
 */
function showHelp() {
  console.log(`
Docker Volume Backup & Restore Script

Usage:
  node scripts/volume-backup.js <command> [options]

Commands:
  backup [type]       Create a backup of the specified volume (default: mysql)
  restore <file>      Restore a volume from backup file
  list                List available backups
  export              Create complete migration package (volume + config)
  import <file>       Import migration package on new machine

Examples:
  # Regular backup
  node scripts/volume-backup.js backup
  node scripts/volume-backup.js backup mysql

  # List and restore
  node scripts/volume-backup.js list
  node scripts/volume-backup.js restore mysql-backup-2024-01-09T10-30-00.tar.gz

  # Migration to new machine
  node scripts/volume-backup.js export
  # Transfer djsh-migration-*.tar.gz to new machine, then:
  node scripts/volume-backup.js import djsh-migration-2024-01-09T10-30-00.tar.gz

Backup Location:
  ${BACKUP_DIR}

Notes:
  - Stop containers before restore for data consistency
  - Export creates a complete migration package with instructions
  - Import restores volume and provides setup guidance
`);
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'backup':
      backupVolume(args[1] || 'mysql');
      break;
    case 'restore':
      if (!args[1]) {
        console.error('Error: Please specify backup file to restore');
        console.error('Usage: node scripts/volume-backup.js restore <file>');
        process.exit(1);
      }
      restoreVolume(args[1]);
      break;
    case 'list':
      listBackups();
      break;
    case 'export':
      exportMigration();
      break;
    case 'import':
      if (!args[1]) {
        console.error('Error: Please specify migration package to import');
        console.error('Usage: node scripts/volume-backup.js import <file>');
        process.exit(1);
      }
      importMigration(args[1]);
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

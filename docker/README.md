# Docker Infrastructure for DJSH Finance App

Complete Docker containerization setup with production-ready infrastructure.

## Directory Structure

```
docker/
├── compose/                          # Docker Compose files
│   ├── docker-compose.yml           # Main production config
│   ├── docker-compose.dev.yml       # Development overrides
│   └── docker-compose.swarm.yml     # Docker Swarm deployment
│
├── images/                           # Dockerfile definitions
│   ├── frontend/
│   │   ├── Dockerfile               # Frontend multi-stage build
│   │   ├── Dockerfile.dev           # Frontend development with hot reload
│   │   └── .dockerignore
│   └── backend/
│       ├── Dockerfile               # Backend multi-stage build
│       ├── Dockerfile.dev           # Backend development with nodemon
│       └── .dockerignore
│
├── scripts/                          # Docker management scripts
│   ├── docker-setup.js              # Config → .env generator, secrets
│   ├── docker-logs.js               # Log management & monitoring
│   ├── volume-backup.js             # Backup, restore, migration
│   └── swarm-manager.js             # Swarm lifecycle management
│
├── volumes/                          # Data directories
│   ├── secrets/                     # Docker secrets (passwords, tokens)
│   ├── backups/                     # Database backups
│   └── logs/                        # Container logs
│
└── README.md                        # This file
```

## Root-level Symlinks

For convenience, the following symlinks are created in the root directory:

```
Dockerfile → docker/images/frontend/Dockerfile
Dockerfile.dev → docker/images/frontend/Dockerfile.dev
.dockerignore → docker/images/frontend/.dockerignore
docker-compose.yml → docker/compose/docker-compose.yml
docker-compose.dev.yml → docker/compose/docker-compose.dev.yml
docker-compose.swarm.yml → docker/compose/docker-compose.swarm.yml
secrets/ → docker/volumes/secrets/
backups/ → docker/volumes/backups/
logs/ → docker/volumes/logs/
scripts/docker-setup.js → docker/scripts/docker-setup.js
scripts/docker-logs.js → docker/scripts/docker-logs.js
scripts/volume-backup.js → docker/scripts/volume-backup.js
scripts/swarm-manager.js → docker/scripts/swarm-manager.js
```

This allows you to run docker commands from the root directory:
```bash
docker compose up -d --build
node scripts/docker-setup.js --init
node scripts/docker-logs.js status
```

## Quick Start

### 1. Initialize Configuration
```bash
node scripts/docker-setup.js --init
```
This creates:
- `config.json` with generated secrets
- `docker/volumes/secrets/` with password and token files
- `.env` file for docker compose

### 2. Start Services
```bash
docker compose up -d --build
```
Starts three services:
- **MySQL**: Database (port 3306)
- **Backend**: Express API (port 8080)
- **Frontend**: Next.js UI (port 3000)

### 3. Monitor Status
```bash
node scripts/docker-logs.js status
```
Shows health status of all containers.

## Docker Compose Files

### docker-compose.yml (Production)
Main configuration for development and production use.
- 3 services: MySQL, Backend, Frontend
- Security hardening (read-only FS, cap drop, secrets)
- Health checks with service dependencies
- Named volume for MySQL persistence

### docker-compose.dev.yml
Development overrides for hot reloading:
- Mounts source code as bind volumes
- Uses `Dockerfile.dev` with nodemon and next dev
- Enables debug ports

Run: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up`

### docker-compose.swarm.yml
Docker Swarm deployment with replicas:
- Load balancing via routing mesh
- Configurable replicas per service
- Rolling updates with auto-rollback
- Resource limits and reservations

## Scripts

### docker-setup.js
Generates `.env` from `config.json` and manages secrets.

```bash
node scripts/docker-setup.js          # Generate .env
node scripts/docker-setup.js --init   # Initialize config.json
node scripts/docker-setup.js --check  # Validate config
node scripts/docker-setup.js --swarm  # Show Swarm instructions
```

### docker-logs.js
Comprehensive log management and monitoring.

```bash
node scripts/docker-logs.js status    # Show container status & health
node scripts/docker-logs.js logs      # Stream logs from all services
node scripts/docker-logs.js logs backend   # Stream backend logs only
node scripts/docker-logs.js errors    # Show error logs only
node scripts/docker-logs.js export    # Export logs to files
node scripts/docker-logs.js report    # Generate full status report
node scripts/docker-logs.js stats     # Show log statistics
node scripts/docker-logs.js watch     # Live monitoring (auto-refresh)
```

### volume-backup.js
Backup and migrate MySQL data.

```bash
node scripts/volume-backup.js backup        # Create backup
node scripts/volume-backup.js list          # List backups
node scripts/volume-backup.js restore <file>  # Restore backup
node scripts/volume-backup.js export        # Create migration package
node scripts/volume-backup.js import <file> # Import on new machine
```

### swarm-manager.js
Docker Swarm lifecycle management.

```bash
node scripts/swarm-manager.js init      # Initialize Swarm cluster
node scripts/swarm-manager.js build     # Build and push images
node scripts/swarm-manager.js deploy    # Deploy stack
node scripts/swarm-manager.js status    # Show stack status
node scripts/swarm-manager.js scale backend 3  # Scale service
node scripts/swarm-manager.js logs backend     # View service logs
node scripts/swarm-manager.js remove    # Remove stack
```

## Configuration

All settings are defined in `config.json` at the root level. The structure includes:

### app
- `name`: Application name
- `timezone`: Server timezone

### database
- `port`: MySQL port
- `name`: Database name
- `user`: MySQL user
- `password`: Auto-generated on init
- `rootPassword`: Auto-generated on init
- `charset`: Character set
- `collation`: Collation

### jwt
- `accessSecret`: Auto-generated on init
- `refreshSecret`: Auto-generated on init
- `accessExpiresIn`: Token expiration (default: 8h)
- `refreshExpiresIn`: Token expiration (default: 30d)

### docker
- `networkName`: Docker network name
- `volumes`: Volume names
- `externalPorts`: Exposed ports

### swarm
- `enabled`: Enable Swarm mode
- `replicas`: Number of replicas per service
- `resources`: CPU/memory limits
- `updateConfig`: Rolling update settings

### logging
- `driver`: Logging driver (json-file, local, etc.)
- `options`: Log rotation (maxSize, maxFile, compress)
- `export`: Log export settings (directory, retention)

## Security

Security features implemented:

| Feature | Implementation |
|---------|----------------|
| **Secrets** | File-based via `/run/secrets/` |
| **Read-only FS** | `read_only: true` with tmpfs |
| **Capabilities** | `cap_drop: ALL` (minimal per service) |
| **Privileges** | `no-new-privileges: true` |
| **SUID/SGID** | Removed in Dockerfiles |
| **Network** | Internal bridge network isolation |

## Secrets Management

Secrets are stored in `docker/volumes/secrets/`:

```
secrets/
├── mysql_root_password.txt
├── mysql_password.txt
├── jwt_access_secret.txt
└── jwt_refresh_secret.txt
```

Generated automatically by `docker-setup.js --init` and mounted as read-only files in containers at `/run/secrets/`.

## Storage

### Volumes

| Mount Type | Service | Path | Purpose |
|------------|---------|------|---------|
| Named Volume | MySQL | `/var/lib/mysql` | Database persistence |
| Bind Mount (ro) | MySQL | `/docker-entrypoint-initdb.d/` | Schema init |
| Secrets | All | `/run/secrets/` | Credentials |
| tmpfs | Frontend/Backend | `/tmp`, cache dirs | Temporary files |

### Persistence

MySQL data is stored in the `djsh-mysql-data` named volume. This survives container restarts and can be backed up using `volume-backup.js`.

## Logs

### Log Configuration

- **Driver**: json-file (default)
- **Rotation**: 10MB max per file, 5 files retained
- **Tags**: Container name and ID

### Log Export

Use `docker-logs.js export` to create timestamped log files:
- `mysql-YYYY-MM-DDTHH-MM-SS.log`
- `backend-YYYY-MM-DDTHH-MM-SS.log`
- `frontend-YYYY-MM-DDTHH-MM-SS.log`
- `combined-YYYY-MM-DDTHH-MM-SS.log`
- `errors-YYYY-MM-DDTHH-MM-SS.log` (error summary)

Exported logs are stored in `docker/volumes/logs/`.

## Networking

### Internal Network (djsh-network)

Services communicate via internal names:
- `djsh-mysql:3306` - MySQL
- `djsh-backend:8080` - Backend API
- `djsh-frontend:3000` - Frontend

### External Access

- `http://localhost:3000` - Frontend (browser)
- `http://localhost:8080` - Backend API (browser)
- `localhost:3306` - MySQL CLI

## Docker Swarm

For production multi-node deployment:

```bash
# Initialize Swarm on manager node
docker swarm init --advertise-addr <manager-ip>

# Deploy stack
docker stack deploy -c docker-compose.swarm.yml djsh

# View status
docker stack services djsh
docker stack ps djsh
```

Features:
- **Routing Mesh**: Load balancing across replicas
- **Rolling Updates**: Zero-downtime deployments
- **Auto-recovery**: Unhealthy containers restarted automatically
- **Resource Management**: CPU/memory limits per service

## Troubleshooting

### Check Service Status
```bash
node scripts/docker-logs.js status
```

### View Error Logs
```bash
node scripts/docker-logs.js errors
```

### Generate Full Report
```bash
node scripts/docker-logs.js report
```

### Stream Live Logs
```bash
docker compose logs -f backend
```

### Restart Services
```bash
docker compose restart
```

### Reset Everything
```bash
docker compose down -v    # Remove containers and volumes
docker compose up -d --build  # Rebuild and restart
```

## File Permissions

After first init, ensure correct permissions:

```bash
chmod 600 docker/volumes/secrets/*.txt
chmod 700 docker/volumes/secrets/
```

The `docker-setup.js` script sets these automatically.

## References

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Docker Security](https://docs.docker.com/engine/security/)
- [Docker Compose](https://docs.docker.com/compose/)
- [Docker Swarm](https://docs.docker.com/engine/swarm/)
- [Docker Storage](https://docs.docker.com/engine/storage/)
- [Docker Logging](https://docs.docker.com/engine/logging/)

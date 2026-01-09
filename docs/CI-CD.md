# GitHub Actions CI/CD Pipeline

## Overview

This document describes the automated GitHub Actions workflow for building and deploying Docker images for the DJSH Finance App.

The pipeline automatically:
- Validates Docker Compose configuration files
- Builds Docker images for frontend and backend with multi-platform support (amd64 + arm64)
- Pushes images to Docker Hub registry
- Scans images for security vulnerabilities using Trivy
- Generates deployment summaries with instructions

**Trigger**: Automatic on push to `main` or `jiusi` branches (or manual via workflow_dispatch)

---

## Workflow Architecture

```
Push to main/jiusi
    │
    ├─► validate
    │   └─► Docker Compose syntax validation
    │       • Production compose
    │       • Development compose
    │       • Swarm compose
    │
    ├─► build-frontend (parallel)
    │   ├─► Setup multi-platform support (QEMU)
    │   ├─► Setup Docker Buildx
    │   ├─► Authenticate to Docker Hub
    │   ├─► Extract metadata (tags, labels)
    │   └─► Build and push (linux/amd64, linux/arm64)
    │
    ├─► build-backend (parallel)
    │   ├─► Setup multi-platform support (QEMU)
    │   ├─► Setup Docker Buildx
    │   ├─► Authenticate to Docker Hub
    │   ├─► Extract metadata (tags, labels)
    │   └─► Build and push (linux/amd64, linux/arm64)
    │
    ├─► scan (runs after builds)
    │   ├─► Scan frontend image with Trivy
    │   │   ├─► SARIF upload to Security tab
    │   │   └─► Table format in logs
    │   └─► Scan backend image with Trivy
    │       ├─► SARIF upload to Security tab
    │       └─► Table format in logs
    │
    └─► summary (always runs)
        └─► Generate deployment instructions
```

---

## Image Naming and Tagging Strategy

### Naming Convention

```
docker.io/<dockerhub-username>/djsh-<service>:<tag>
```

### Tag Strategy

When code is pushed to the `main` or `jiusi` branch, each image receives three tags:

| Tag Type | Format | Example | Use Case |
|----------|--------|---------|----------|
| **SHA** | `<branch>-<sha>` | `jiusi-a1b2c3d` | Specific commit traceability |
| **Branch** | `<branch>` | `jiusi` | Latest from branch |
| **Latest** | `latest` | `latest` | Only from main/jiusi |

### Examples

Frontend images from a commit `a1b2c3d` pushed to `jiusi` branch:
```
docker.io/username/djsh-frontend:jiusi-a1b2c3d
docker.io/username/djsh-frontend:jiusi
docker.io/username/djsh-frontend:latest  (if jiusi has latest tag enabled)
```

Backend images from the same commit:
```
docker.io/username/djsh-backend:jiusi-a1b2c3d
docker.io/username/djsh-backend:jiusi
docker.io/username/djsh-backend:latest  (if jiusi has latest tag enabled)
```

---

## Docker Hub Setup

### Prerequisites

1. **Docker Hub Account**
   - Create account at https://hub.docker.com (if not already created)

2. **Access Token**
   - Go to **Account Settings** → **Security** → **New Access Token**
   - Token name: `github-actions-djsh`
   - Permissions: `Read & Write`
   - Save the token (shown only once)

3. **GitHub Secrets Configuration**
   - Go to repository **Settings** → **Secrets and variables** → **Actions**
   - Create `DOCKERHUB_USERNAME`: Your Docker Hub username
   - Create `DOCKERHUB_TOKEN`: Your access token (NOT password)
   - Optional: `NEXT_PUBLIC_API_BASE_URL`: Frontend API URL (default: http://localhost:8080)

### Repositories

The following repositories will be created automatically on first push:

- `<username>/djsh-frontend` - Next.js frontend application
- `<username>/djsh-backend` - Express.js backend API

---

## Build Configuration

### Frontend Build

| Property | Value |
|----------|-------|
| **Context** | `.` (root directory) |
| **Dockerfile** | `docker/images/frontend/Dockerfile` |
| **Platforms** | linux/amd64, linux/arm64 |
| **Build Args** | `NEXT_PUBLIC_API_BASE_URL` |
| **Cache** | GitHub Actions (scope: frontend) |
| **Size** | ~200 MB per platform |

### Backend Build

| Property | Value |
|----------|-------|
| **Context** | `./backend` |
| **Dockerfile** | `docker/images/backend/Dockerfile` |
| **Platforms** | linux/amd64, linux/arm64 |
| **Build Args** | None |
| **Cache** | GitHub Actions (scope: backend) |
| **Size** | ~150 MB per platform |

---

## Security Scanning

### Trivy Configuration

- **Tool**: Trivy (aquasecurity/trivy-action@0.24.0)
- **Severity Levels**: CRITICAL, HIGH
- **Timeout**: 10 minutes per image
- **Failure Mode**: Fails if HIGH or CRITICAL vulnerabilities found
- **Reports**: SARIF + human-readable table

### Vulnerability Reporting

1. **SARIF Upload**
   - Automatically uploaded to GitHub Security tab
   - Accessible via **Security** → **Code scanning alerts**
   - Each vulnerability shows:
     - Package name and version
     - Vulnerability ID (CVE)
     - Severity level
     - Fix available (if applicable)

2. **Workflow Logs**
   - Table format shows all findings
   - Scan step shows `exit code: 1` if vulnerabilities found
   - Workflow continues for reporting (doesn't block summary)

### Addressing Vulnerabilities

When Trivy finds HIGH/CRITICAL vulnerabilities:

1. **Check GitHub Security Tab**
   - Review vulnerability details
   - Check if updates available

2. **Update Dependencies**
   ```bash
   # Frontend
   npm audit fix
   npm update

   # Backend
   cd backend
   npm audit fix
   npm update
   ```

3. **Review Dockerfile**
   - Update base image to latest secure version
   - Minimize installed packages
   - Use multi-stage builds to reduce final image size

4. **Test Locally**
   ```bash
   # Build image
   docker buildx build \
     --platform linux/amd64 \
     -f docker/images/frontend/Dockerfile \
     -t test:latest \
     .

   # Scan locally
   trivy image --severity HIGH,CRITICAL test:latest
   ```

---

## Deployment Instructions

### Manual Deployment

Once images are built and pushed to Docker Hub:

```bash
# Pull latest images
docker pull <username>/djsh-frontend:latest
docker pull <username>/djsh-backend:latest

# Update docker-compose.yml if needed
# Then deploy
docker compose up -d
```

### Automated Deployment

The workflow generates deployment instructions in the summary step. These are visible in:
1. **Workflow run summary** (GitHub Actions → Workflows → Docker Build)
2. **Job logs** under "Check job statuses"

### Verify Deployment

```bash
# Check backend API
curl http://localhost:8080/lookups/version

# Check frontend
curl http://localhost:3000

# View logs
docker compose logs -f
```

---

## Performance Expectations

### Build Times

| Phase | First Build | Cached Build |
|-------|-------------|--------------|
| Validate | ~30 seconds | ~30 seconds |
| Frontend Build | ~8-10 min | ~3-4 min |
| Backend Build | ~6-8 min | ~2-3 min |
| Security Scan | ~2-3 min | ~2-3 min |
| **Total** | **~20-25 min** | **~8-12 min** |

### Storage Usage

| Component | Size |
|-----------|------|
| Frontend image (per platform) | ~200 MB |
| Backend image (per platform) | ~150 MB |
| Total per build | ~700 MB (2 images × 2 platforms) |
| GitHub Actions cache | ~500 MB per scope |

### GitHub Actions Quota

- **Free Tier**: 2000 minutes/month
- **Per Run**: ~20-25 min (first), ~8-12 min (cached)
- **Estimated Monthly Runs**: 80-100 builds
- **Cache Limit**: 10 GB total
- **Retention**: Cache expires after 7 days of non-use

---

## Monitoring and Troubleshooting

### Workflow Status

Check workflow status in GitHub:
```bash
# View latest run
gh run list --workflow=docker-build.yml

# Watch a specific run
gh run view <run-id> --log

# Re-run a workflow
gh run rerun <run-id>
```

### Common Issues and Solutions

#### Issue: "No space left on device"

**Cause**: Disk space exhausted during build

**Solution**:
```bash
# Clear GitHub Actions cache
gh cache delete --all

# Re-run workflow
gh run rerun <run-id>
```

#### Issue: "Failed to authenticate with Docker Hub"

**Cause**: Invalid or expired credentials

**Solution**:
1. Verify `DOCKERHUB_TOKEN` in GitHub Secrets
2. Generate new token in Docker Hub Account Settings
3. Update GitHub Secret with new token
4. Re-run workflow

#### Issue: "Security scan found vulnerabilities"

**Cause**: Image contains HIGH or CRITICAL vulnerabilities

**Solution**:
1. Go to GitHub Security tab → Code scanning alerts
2. Review vulnerabilities and available fixes
3. Update dependencies in package.json
4. Commit and push to trigger new build

#### Issue: "Build timeout"

**Cause**: Build took longer than default timeout

**Solution**:
- First build without cache is slow (expected ~10-15 min)
- Subsequent builds are faster (~3-5 min) due to caching
- If consistent timeouts, increase timeout in workflow YAML

#### Issue: "Multi-platform build is very slow"

**Cause**: Building for both amd64 and arm64

**Solution**:
- This is expected on first run (no cache)
- Subsequent builds are much faster
- For development, can temporarily build single platform:
  ```yaml
  platforms: linux/amd64
  ```

### Logs and Debugging

**View detailed logs**:
```bash
# Full workflow logs
gh run view <run-id> --log

# Specific job logs
gh run view <run-id> --job=build-frontend --log

# Last 100 lines
gh run view <run-id> --log | tail -100
```

**Check validation errors**:
```bash
# Locally validate compose files
docker compose -f docker/compose/docker-compose.yml config

# Validate swarm compose
docker compose -f docker-compose.swarm.yml config
```

---

## Concurrency and Rate Limiting

### GitHub Actions Concurrency

The workflow uses concurrency groups to ensure only one build per branch runs at a time:

```yaml
concurrency:
  group: docker-build-${{ github.ref }}
  cancel-in-progress: true
```

This means:
- If you push multiple commits quickly, only the latest builds
- Previous builds are automatically cancelled
- Saves GitHub Actions quota

### Docker Hub Rate Limits

For **authenticated users** (which this workflow is):
- **Pull rate limit**: 200/6 hours
- **Push rate limit**: Unlimited
- **Image limit**: No hard limit on number of images

The workflow authenticates using `DOCKERHUB_TOKEN`, so pull limits are generous.

---

## Verification Steps

### Pre-Deployment Testing

Test the workflow setup locally before deploying:

```bash
# 1. Validate compose files
docker compose -f docker/compose/docker-compose.yml config
docker compose -f docker/compose/docker-compose.yml -f docker/compose/docker-compose.dev.yml config
docker compose -f docker-compose.swarm.yml config

# 2. Test multi-platform build (requires buildx)
docker buildx create --use --name test-builder

# Frontend
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f docker/images/frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_BASE_URL=http://localhost:8080 \
  -t test-frontend:latest \
  .

# Backend
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f docker/images/backend/Dockerfile \
  -t test-backend:latest \
  ./backend

# 3. Test security scanning (if Trivy installed)
trivy image --severity HIGH,CRITICAL test-frontend:latest
trivy image --severity HIGH,CRITICAL test-backend:latest
```

### Post-Deployment Verification

After first successful workflow run:

```bash
# 1. Verify images exist on Docker Hub
docker pull <username>/djsh-frontend:latest
docker pull <username>/djsh-backend:latest

# 2. Inspect image metadata
docker inspect <username>/djsh-frontend:latest
docker inspect <username>/djsh-backend:latest

# 3. Check multi-platform support
docker buildx imagetools inspect <username>/djsh-frontend:latest

# 4. Test deployment
docker compose pull
docker compose up -d

# 5. Verify services are running
curl http://localhost:8080/lookups/version
curl http://localhost:3000

# 6. Check GitHub Security tab
# Go to Security → Code scanning alerts
# Verify Trivy reports are present for both images
```

---

## Workflow Events and Triggers

### Automatic Triggers

The workflow runs automatically on:

1. **Push to protected branches**
   - Branch: `main` or `jiusi`
   - Only if files in these paths change:
     - `src/**` (frontend source)
     - `backend/**` (backend source)
     - `docker/**` (Docker files)
     - `package.json`, `package-lock.json`
     - `next.config.js`, `tailwind.config.ts`
     - `.github/workflows/docker-build.yml`

2. **Manual Trigger** (workflow_dispatch)
   - Navigate to: **Actions** → **Docker Build & Push** → **Run workflow**
   - Optional: Check "Push images to Docker Hub" (default: true)

### Skipping Workflows

To skip workflow for a commit, add `[skip ci]` to commit message:
```bash
git commit -m "docs: update README [skip ci]"
```

---

## Environment Variables

The workflow uses environment variables defined in `.github/workflows/docker-build.yml`:

| Variable | Value | Purpose |
|----------|-------|---------|
| `REGISTRY` | `docker.io` | Docker Hub registry |
| `FRONTEND_IMAGE` | `${{ secrets.DOCKERHUB_USERNAME }}/djsh-frontend` | Frontend image name |
| `BACKEND_IMAGE` | `${{ secrets.DOCKERHUB_USERNAME }}/djsh-backend` | Backend image name |

And build-arg for frontend:
| Arg | Value | Purpose |
|-----|-------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | From secret or default `http://localhost:8080` | Frontend API endpoint |

---

## Permissions

The workflow uses minimal required permissions:

- `contents: read` - Read repository code
- `packages: write` - Write to container registry
- `security-events: write` - Upload security scan results
- `actions: read` - Read workflow status

---

## Future Enhancements

### Phase 2: Deployment Automation

- Auto-deploy to staging on merge to `jiusi`
- Manual one-click deployment to production for `main`
- Rollback functionality for failed deployments

### Phase 3: Version Management

- Build on semantic version tags (v*.*.*)
- Automatic changelog generation
- Release notes in GitHub Releases

### Phase 4: Advanced Monitoring

- Build time tracking and trends
- Image size tracking
- Vulnerability tracking and trending
- Cost analysis for GitHub Actions usage

---

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Build Action](https://github.com/docker/build-push-action)
- [Trivy Scanner](https://github.com/aquasecurity/trivy)
- [Docker Buildx](https://docs.docker.com/buildx/working-with-buildx/)
- [SARIF Format](https://sarifweb.azurewebsites.net/)

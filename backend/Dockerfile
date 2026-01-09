# ===========================================
# DJSH Finance App - Backend Dockerfile
# Multi-stage production build for Express.js
# Security hardened for production deployment
# ===========================================

# -------------------------------------------
# Stage 1: Dependencies
# -------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app

# Install build dependencies for native modules (bcrypt)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies
# Use npm ci if lock file exists, otherwise npm install
RUN if [ -f package-lock.json ]; then npm ci --only=production; else npm install --only=production; fi

# -------------------------------------------
# Stage 2: Production Runner
# -------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

# Security labels
LABEL org.opencontainers.image.title="DJSH Backend API" \
      org.opencontainers.image.description="Express.js API server for DJSH Finance App" \
      org.opencontainers.image.vendor="DJSH" \
      security.privileged="false" \
      security.allowPrivilegeEscalation="false"

# Set production environment
ENV NODE_ENV=production

# Install runtime dependencies for bcrypt and wget for health check
RUN apk add --no-cache libc6-compat

# Security hardening: Remove setuid/setgid binaries to prevent privilege escalation
RUN find / -perm /6000 -type f -exec chmod a-s {} \; 2>/dev/null || true

# Create non-root user with explicit home directory
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --home /app expressjs

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Create required directories with proper ownership
# /tmp is provided by tmpfs mount in docker-compose for security
RUN mkdir -p uploads && \
    chown -R expressjs:nodejs /app

# Switch to non-root user
USER expressjs

# Expose port (documentation only, actual binding done in docker-compose)
EXPOSE 8080

# Health check - hits the version endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/lookups/version || exit 1

# Use dumb-init or node directly (node handles signals properly in modern versions)
CMD ["node", "server.js"]

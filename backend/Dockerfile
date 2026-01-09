# ===========================================
# DJSH Finance App - Backend Dockerfile
# Multi-stage production build for Express.js
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

# Set production environment
ENV NODE_ENV=production

# Install runtime dependencies for bcrypt
RUN apk add --no-cache libc6-compat

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 expressjs

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Create uploads directory (for multer file uploads)
RUN mkdir -p uploads && chown expressjs:nodejs uploads

# Set ownership
RUN chown -R expressjs:nodejs /app

# Switch to non-root user
USER expressjs

# Expose port
EXPOSE 8080

# Health check - hits the version endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/lookups/version || exit 1

# Start the application
CMD ["node", "server.js"]

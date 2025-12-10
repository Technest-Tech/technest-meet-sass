# Use specific Node version for security and reproducibility
FROM node:20.11.0-alpine3.19

# Install only essential dependencies for native modules
RUN apk add --no-cache openssl && \
    # Remove dangerous tools that could be exploited
    apk del --no-cache wget curl netcat-openbsd nc 2>/dev/null || true

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install dependencies
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Create data directory for database
RUN mkdir -p /app/data

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Create non-root user with specific UID/GID
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# Change ownership of the app directory
RUN chown -R nextjs:nodejs /app && \
    chmod 755 /app/data && \
    # Remove write permissions from build artifacts
    chmod -R a-w /app/.next 2>/dev/null || true

# Set read-only for sensitive directories (using tmpfs in docker-compose)
# Note: We keep /bin/sh as npm requires it to run scripts
# Security is maintained through read-only filesystem and non-root user

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["npm", "start"]
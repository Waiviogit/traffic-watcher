# Multi-stage build for Traffic Watcher

# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Production image with vnstat
FROM node:20-alpine

# Install vnstat
RUN apk add --no-cache vnstat

# Create app directory
WORKDIR /app

# Copy backend
COPY backend/package*.json ./
RUN npm install

COPY backend/ ./

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./public

# Add nginx for serving frontend (optional, using express static)
# We'll serve static files from express instead

# Create vnstat database directory
RUN mkdir -p /var/lib/vnstat

# Startup script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV NODE_ENV=production

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "src/index.js"]


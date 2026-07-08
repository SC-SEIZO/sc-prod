# --- Stage 1: Build Application ---
FROM node:22-alpine AS builder
WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy the rest of the application files
COPY . .

# Build both frontend static files and compiled server
RUN npm run build:all

# --- Stage 2: Runner ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy package descriptors
COPY package*.json ./

# Install production-only dependencies
RUN npm ci --only=production

# Copy built resources from builder stage
COPY --from=builder /app/dist ./dist

# Expose server port
EXPOSE 3000

# Start server
CMD ["node", "dist/server.cjs"]

# Multi-stage build for optimized production image
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Development image (for tests and development)
FROM base AS dev
WORKDIR /app
COPY package*.json ./
RUN npm ci # Instala todas las dependencias incluyendo devDependencies
COPY . .
CMD ["npm", "run", "dev"]

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy built application from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./

# Copy built files from source
COPY . .

USER nodejs

EXPOSE 3000
CMD ["node", "dist/index.js"]

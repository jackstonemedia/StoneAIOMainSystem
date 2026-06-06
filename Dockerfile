# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files first for layer caching
COPY package.json package-lock.json ./

# Install ALL deps (needed for vite build + prisma generate)
RUN npm install

# Copy source
COPY . .

# Generate Prisma client + build Vite frontend
RUN npx prisma generate
RUN npm run build

# ── Stage 2: Production runtime ───────────────────────────────────────────────
FROM node:20-slim AS runner

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built frontend and server source
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy server source files needed at runtime
COPY server.ts ./
COPY tsconfig.json tsconfig.server.json ./
COPY api ./api
COPY infrastructure ./infrastructure
COPY prisma ./prisma
COPY packages ./packages

# Re-install tsx for runtime TypeScript execution (dev dep)
RUN npm install --no-save tsx

EXPOSE 4000

ENV NODE_ENV=production

CMD ["npx", "tsx", "server.ts"]

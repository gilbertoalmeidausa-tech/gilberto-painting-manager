FROM node:22-alpine
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy workspace manifests for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN pnpm install --frozen-lockfile

# Copy source (shared + client only)
COPY shared ./shared
COPY client ./client

# Build shared first (client imports from @painting/shared), then client
RUN pnpm --filter @painting/shared build
RUN pnpm --filter @painting/client build

EXPOSE 4173

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-4173}/ || exit 1

# vite preview --host makes it reachable outside the container; $PORT is injected by Railway
CMD ["sh", "-c", "cd client && ../node_modules/.bin/vite preview --host 0.0.0.0 --port ${PORT:-4173}"]

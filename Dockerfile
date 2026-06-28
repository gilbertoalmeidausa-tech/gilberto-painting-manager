FROM node:22-alpine
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy manifests first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN pnpm install --frozen-lockfile

# Copy source
COPY shared ./shared
COPY server ./server
COPY client ./client

# Build: shared → server → client
RUN pnpm build

# Uploads directory — matches UPLOADS_DIR in server/src/lib/storage.ts
# (/app/server/uploads). Mount a Railway Volume here for persistence.
RUN mkdir -p server/uploads

# Run in production at runtime (set AFTER install/build so devDependencies
# remain available for the build step above). Railway env vars override this.
ENV NODE_ENV=production

EXPOSE 3000

# Respect the port Railway injects via $PORT (falls back to 3000 locally)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/health || exit 1

# Run migrations then start server
CMD ["sh", "-c", "node server/dist/db/migrate.js && node server/dist/index.js"]

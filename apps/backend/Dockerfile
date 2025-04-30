ARG NODE_VERSION=22

# Alpine image
FROM node:${NODE_VERSION}-alpine AS alpine
RUN apk update
RUN apk add --no-cache libc6-compat

# Setup pnpm and turbo on the alpine base
FROM alpine AS base
RUN npm install pnpm turbo --global
RUN pnpm config set store-dir ~/.pnpm-store

# Prune projects
FROM base AS pruner
ARG PROJECT=backend

WORKDIR /app
COPY . .
RUN turbo prune ${PROJECT} --docker

# Build the project
FROM base AS builder
ARG PROJECT=backend

WORKDIR /app

# Copy lockfile and package.json's of isolated subworkspace
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=pruner /app/out/json/ .

# First install the dependencies (as they change less often)
RUN --mount=type=cache,id=pnpm,target=~/.pnpm-store pnpm install --frozen-lockfile

# Copy source code of isolated subworkspace
COPY --from=pruner /app/out/full/ .

RUN turbo build --filter=${PROJECT}
RUN --mount=type=cache,id=pnpm,target=~/.pnpm-store pnpm prune --prod --no-optional

# Final image
FROM alpine AS runner
ARG PROJECT=backend

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs
USER nodejs

WORKDIR /app

# Only copy the necessary production files to the final image
COPY --from=builder --chown=nodejs:nodejs /app/apps/${PROJECT}/dist /app/apps/${PROJECT}/dist
COPY --from=builder --chown=nodejs:nodejs /app/apps/${PROJECT}/node_modules /app/apps/${PROJECT}/node_modules
COPY --from=builder --chown=nodejs:nodejs /app/apps/${PROJECT}/package.json /app/apps/${PROJECT}/package.json

COPY --from=builder --chown=nodejs:nodejs /app/node_modules /app/node_modules

COPY --from=builder --chown=nodejs:nodejs /app/packages/api/node_modules /app/packages/api/node_modules
COPY --from=builder --chown=nodejs:nodejs /app/packages/api/package.json /app/packages/api/package.json
COPY --from=builder --chown=nodejs:nodejs /app/packages/api/dist /app/packages/api/dist

COPY --from=builder --chown=nodejs:nodejs /app/packages/database/node_modules /app/packages/database/node_modules
COPY --from=builder --chown=nodejs:nodejs /app/packages/database/package.json /app/packages/database/package.json
COPY --from=builder --chown=nodejs:nodejs /app/packages/database/dist /app/packages/database/dist

COPY --from=builder --chown=nodejs:nodejs /app/packages/validator/node_modules /app/packages/validator/node_modules
COPY --from=builder --chown=nodejs:nodejs /app/packages/validator/package.json /app/packages/validator/package.json
COPY --from=builder --chown=nodejs:nodejs /app/packages/validator/dist /app/packages/validator/dist

COPY --from=builder --chown=nodejs:nodejs /app/packages/eslint-config /app/packages/eslint-config
COPY --from=builder --chown=nodejs:nodejs /app/packages/typescript-config /app/packages/typescript-config

WORKDIR /app/apps/${PROJECT}

ARG PORT=3020
ENV PORT=${PORT}
ENV NODE_ENV=dev
EXPOSE ${PORT}

# Add health check
HEALTHCHECK --interval=60s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

CMD ["node", "dist/main"]
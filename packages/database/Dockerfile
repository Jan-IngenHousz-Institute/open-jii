# Base image with Node
ARG NODE_VERSION=26

# Alpine image
FROM node:${NODE_VERSION}-alpine AS alpine
# CI passes the ISO week, so a cached upgrade layer is at most a week old.
ARG APK_REFRESH
RUN apk update && apk upgrade --no-cache
RUN apk add --no-cache libc6-compat tini
ENV TURBO_TELEMETRY_DISABLED=1

# Setup pnpm and turbo on the alpine base
FROM alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# pnpm prompts before purging a stale modules dir; CI=true keeps builds non-interactive
ENV CI=true
RUN npm install --global corepack@0.36.0 && corepack enable
# The repository's own turbo, so `turbo prune` behaves as it does outside Docker.
COPY package.json /tmp/package.json
RUN npm install --global "turbo@$(node -p "require('/tmp/package.json').devDependencies.turbo")"

# Prune projects
FROM base AS pruner
ARG PROJECT=database

WORKDIR /app
COPY . .
RUN turbo prune @repo/${PROJECT} --docker

# Build the project
FROM base AS builder
ARG PROJECT=database

WORKDIR /app

# Copy lockfile and package.json's of isolated subworkspace
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=pruner /app/out/json/ .

# First install the dependencies (as they change less often)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Copy source code of isolated subworkspace
COPY --from=pruner /app/out/full/ .

# Reuse the frozen install so parallel builds cannot start competing installs.
RUN pnpm_config_verify_deps_before_run=false turbo build --filter=@repo/${PROJECT}
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm prune --prod --no-optional

# Dependencies stage - create a clean production dependencies directory
FROM builder AS dependencies
ARG PROJECT=database

WORKDIR /app
# Deploy only production dependencies to a separate directory
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm --filter=@repo/${PROJECT} deploy --prod --ignore-scripts --no-optional --legacy /dependencies

# Final image
FROM alpine AS runner
ARG PROJECT=database

# Migrations start with plain node. The package managers bundled in the base
# image never run here, and their vendored dependencies show up in image scans.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
    /opt/yarn-v* /usr/local/bin/yarn /usr/local/bin/yarnpkg

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs
USER nodejs

WORKDIR /app/packages/${PROJECT}

# Copy necessary files for migrations
COPY --from=builder --chown=nodejs:nodejs /app/packages/${PROJECT}/postgres/migrations ./postgres/migrations
COPY --from=builder --chown=nodejs:nodejs /app/packages/${PROJECT}/clickhouse/migrations ./clickhouse/migrations
COPY --from=builder --chown=nodejs:nodejs /app/packages/${PROJECT}/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/${PROJECT}/package.json ./package.json
# Copy only the production dependencies from the dedicated directory
COPY --from=dependencies --chown=nodejs:nodejs /dependencies/node_modules ./node_modules

# Command to run migrations
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/migrate.js"]

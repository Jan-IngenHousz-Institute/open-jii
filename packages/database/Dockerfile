# Base image with Node
ARG NODE_VERSION=22

# Alpine image
FROM node:${NODE_VERSION}-alpine AS alpine
RUN apk update
RUN apk add --no-cache libc6-compat tini
ENV TURBO_TELEMETRY_DISABLED=1

# Setup pnpm and turbo on the alpine base
FROM alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN npm install turbo --global

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

RUN turbo build --filter=@repo/${PROJECT}
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

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs
USER nodejs

WORKDIR /app/packages/${PROJECT}

# Copy necessary files for migrations
COPY --from=builder --chown=nodejs:nodejs /app/packages/${PROJECT}/drizzle ./drizzle
COPY --from=builder --chown=nodejs:nodejs /app/packages/${PROJECT}/scripts ./scripts
COPY --from=builder --chown=nodejs:nodejs /app/packages/${PROJECT}/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/packages/${PROJECT}/package.json ./package.json
# Copy only the production dependencies from the dedicated directory
COPY --from=dependencies --chown=nodejs:nodejs /dependencies/node_modules ./node_modules

# Command to run migrations and set up writer user password
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "node dist/migrate.js && node dist/scripts/set-app-user-passwords.js"]

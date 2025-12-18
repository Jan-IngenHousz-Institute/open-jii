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
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Copy source code of isolated subworkspace
COPY --from=pruner /app/out/full/ .

RUN turbo build --filter=${PROJECT}
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm prune --prod --no-optional

# Dependencies stage - create a clean production dependencies directory
FROM builder AS dependencies
ARG PROJECT=backend

WORKDIR /app
# Deploy only production dependencies to a separate directory
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm --filter=${PROJECT} deploy --prod --ignore-scripts --no-optional --legacy /dependencies

# Final image
FROM alpine AS runner
ARG PROJECT=backend

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs
USER nodejs

WORKDIR /app/apps/${PROJECT}

# Copy necessary files for the backend service
COPY --from=builder --chown=nodejs:nodejs /app/apps/${PROJECT}/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/apps/${PROJECT}/package.json ./package.json
# Copy only the production dependencies from the dedicated directory
COPY --from=dependencies --chown=nodejs:nodejs /dependencies/node_modules ./node_modules

ARG PORT=3020
ENV PORT=${PORT}
ENV NODE_ENV=dev
EXPOSE ${PORT}

# Add health check
HEALTHCHECK --interval=60s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Use tini as init process
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main"]
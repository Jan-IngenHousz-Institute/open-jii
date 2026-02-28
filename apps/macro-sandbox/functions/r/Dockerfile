# ============================================================
# Lambda Function: R Macro Sandbox
# ============================================================
# Build context: apps/macro-sandbox/
#   docker build -f functions/r/Dockerfile -t macro-sandbox-r .
#
# Uses a custom container image with R and a shell-based Lambda
# Runtime API bootstrap (no official AWS Lambda R runtime exists).
#
# The bootstrap implements the Lambda Runtime API:
#   GET  /invocation/next     → receive event
#   POST /invocation/{id}/response → return result
#   POST /invocation/{id}/error    → return error
# ============================================================

FROM debian:bookworm-slim

# Install R, jsonlite, and curl (for Lambda Runtime API polling)
RUN apt-get update && apt-get install -y --no-install-recommends \
    r-base \
    r-cran-jsonlite \
    curl \
    jq \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV LAMBDA_TASK_ROOT=/var/task
WORKDIR /var/task

# Lambda Runtime API bootstrap (shell script)
COPY functions/r/bootstrap /var/runtime/bootstrap
RUN chmod +x /var/runtime/bootstrap

# Lambda handler (processes events, invokes wrapper)
COPY functions/r/handler.R /var/task/handler.R

# Wrapper and helpers
COPY lib/wrappers/wrapper.R /var/task/wrappers/wrapper.R
COPY lib/helpers/helpers.R /var/task/src/helpers/helpers.R

# Lambda Runtime Interface Emulator (RIE) for local testing.
# In real Lambda, AWS_LAMBDA_RUNTIME_API is set — bootstrap runs directly.
# Locally, RIE provides the Runtime API on port 8080.
ADD https://github.com/aws/aws-lambda-runtime-interface-emulator/releases/latest/download/aws-lambda-rie /usr/local/bin/aws-lambda-rie
RUN chmod +x /usr/local/bin/aws-lambda-rie

COPY functions/r/entry.sh /entry.sh
RUN chmod +x /entry.sh

ENTRYPOINT ["/entry.sh"]

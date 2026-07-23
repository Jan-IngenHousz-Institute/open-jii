# R macro sandbox Lambda
# Uses a custom Runtime API bootstrap (no official AWS Lambda R runtime).

FROM debian:bookworm-slim

# Install R, jsonlite, and curl (for Lambda Runtime API polling).
# The --only-upgrade libgnutls30 step patches CVE-2026-33845/42010 (CRITICAL)
# and CVE-2026-33846/3833/42009 (HIGH); fixed in 3.7.9-2+deb12u7.
RUN apt-get update && apt-get install -y --no-install-recommends \
    r-base \
    r-cran-jsonlite \
    curl \
    jq \
    ca-certificates \
    && apt-get install -y --only-upgrade libgnutls30 \
    && rm -rf /var/lib/apt/lists/*

ENV LAMBDA_TASK_ROOT=/var/task
WORKDIR /var/task

COPY functions/r/bootstrap /var/runtime/bootstrap
RUN chmod +x /var/runtime/bootstrap

COPY functions/r/handler.R /var/task/handler.R

# Wrapper, helpers, and contract guard
COPY lib/wrappers/wrapper.R /var/task/wrappers/wrapper.R
COPY lib/helpers/helpers.R /var/task/src/helpers/helpers.R
COPY lib/guards/guard.R /var/task/guards/guard.R

ENTRYPOINT ["/var/runtime/bootstrap"]

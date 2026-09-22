# R macro sandbox Lambda
# Uses a custom Runtime API bootstrap (no official AWS Lambda R runtime).

FROM debian:bookworm-slim

# Install R, jsonlite, and curl (for Lambda Runtime API polling).
# --only-upgrade takes Debian security fixes the base image lacks:
# libgnutls30 3.7.9-2+deb12u7 (CVE-2026-33845/42010 CRITICAL, 33846/3833/42009 HIGH),
# libpcre2-8-0 10.42-1+deb12u1 (CVE-2026-86145/89161 HIGH, regex RCE in R's PCRE2).
RUN apt-get update && apt-get install -y --no-install-recommends \
    r-base \
    r-cran-jsonlite \
    curl \
    jq \
    ca-certificates \
    && apt-get install -y --only-upgrade libgnutls30 libpcre2-8-0 \
    && rm -rf /var/lib/apt/lists/*

ENV LAMBDA_TASK_ROOT=/var/task
WORKDIR /var/task

COPY functions/r/bootstrap /var/runtime/bootstrap
RUN chmod +x /var/runtime/bootstrap

COPY functions/r/handler.R /var/task/handler.R

# Wrapper and helpers
COPY lib/wrappers/wrapper.R /var/task/wrappers/wrapper.R
COPY lib/helpers/helpers.R /var/task/src/helpers/helpers.R

ENTRYPOINT ["/var/runtime/bootstrap"]

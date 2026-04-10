# R macro sandbox Lambda
# Uses a custom Runtime API bootstrap (no official AWS Lambda R runtime).

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

COPY functions/r/bootstrap /var/runtime/bootstrap
RUN chmod +x /var/runtime/bootstrap

COPY functions/r/handler.R /var/task/handler.R

# Wrapper and helpers
COPY lib/wrappers/wrapper.R /var/task/wrappers/wrapper.R
COPY lib/helpers/helpers.R /var/task/src/helpers/helpers.R

# RIE for local testing
ADD https://github.com/aws/aws-lambda-runtime-interface-emulator/releases/latest/download/aws-lambda-rie /usr/local/bin/aws-lambda-rie
RUN chmod +x /usr/local/bin/aws-lambda-rie

COPY functions/r/entry.sh /entry.sh
RUN chmod +x /entry.sh

ENTRYPOINT ["/entry.sh"]

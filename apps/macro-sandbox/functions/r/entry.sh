#!/bin/sh
# Entrypoint for R Lambda container.
# In real Lambda: AWS_LAMBDA_RUNTIME_API is set → run bootstrap directly.
# Locally: no runtime API → start the RIE which provides one on port 8080.

if [ -z "${AWS_LAMBDA_RUNTIME_API}" ]; then
  exec /usr/local/bin/aws-lambda-rie /var/runtime/bootstrap
else
  exec /var/runtime/bootstrap
fi

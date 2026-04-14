#!/bin/sh
# Entrypoint: use RIE locally, bootstrap directly in real Lambda.

if [ -z "${AWS_LAMBDA_RUNTIME_API}" ]; then
  exec /usr/local/bin/aws-lambda-rie /var/runtime/bootstrap
else
  exec /var/runtime/bootstrap
fi

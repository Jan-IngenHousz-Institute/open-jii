# ============================================================
# Lambda Function: JavaScript Macro Sandbox
# ============================================================
# Build context: apps/macro-sandbox/
#   docker build -f functions/javascript/Dockerfile -t macro-sandbox-js .
# ============================================================

FROM public.ecr.aws/lambda/nodejs:24

# Wrapper and helpers
COPY lib/wrappers/wrapper.js ${LAMBDA_TASK_ROOT}/wrappers/wrapper.js
COPY lib/helpers/helpers.js ${LAMBDA_TASK_ROOT}/src/helpers/helpers.js

# Lambda handler
COPY functions/javascript/handler.js ${LAMBDA_TASK_ROOT}/handler.js

CMD ["handler.handler"]

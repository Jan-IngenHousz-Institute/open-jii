# JavaScript macro sandbox Lambda

FROM public.ecr.aws/lambda/nodejs:24

# Remove npm/corepack.
RUN rm -rf /var/lang/lib/node_modules /var/lang/bin/npm /var/lang/bin/npx /var/lang/bin/corepack

# Wrapper and helpers
COPY lib/wrappers/wrapper.js ${LAMBDA_TASK_ROOT}/wrappers/wrapper.js
COPY lib/helpers/helpers.js ${LAMBDA_TASK_ROOT}/src/helpers/helpers.js

# Lambda handler
COPY functions/javascript/handler.js ${LAMBDA_TASK_ROOT}/handler.js

CMD ["handler.handler"]

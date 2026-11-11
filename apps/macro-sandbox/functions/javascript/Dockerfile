# JavaScript macro sandbox Lambda

FROM public.ecr.aws/lambda/nodejs:24

# Takes AL2023 security fixes the base image lacks. The repos are locked to the
# base image's release, so only --releasever=latest reaches them:
# glibc 2.34-231.amzn2023.0.6 (CVE-2026-86805 HIGH),
# rpm 4.16.1.3-29.amzn2023.0.9 (CVE-2026-103242/84837/95519 HIGH).
RUN dnf upgrade -y --releasever=latest glibc glibc-common glibc-langpack-en glibc-minimal-langpack rpm rpm-libs \
 && dnf clean all

# Remove npm/corepack so sandbox code cannot install packages.
RUN rm -rf /var/lang/lib/node_modules/npm /var/lang/lib/node_modules/corepack \
           /var/lang/bin/npm /var/lang/bin/npx /var/lang/bin/corepack

# Wrapper and helpers
COPY lib/wrappers/wrapper.js ${LAMBDA_TASK_ROOT}/wrappers/wrapper.js
COPY lib/helpers/helpers.js ${LAMBDA_TASK_ROOT}/src/helpers/helpers.js

# Lambda handler
COPY functions/javascript/handler.js ${LAMBDA_TASK_ROOT}/handler.js

CMD ["handler.handler"]

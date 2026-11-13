# Python macro sandbox Lambda

FROM public.ecr.aws/lambda/python:3.12

# Takes AL2023 security fixes the base image lacks. The repos are locked to the
# base image's release, so only --releasever=latest reaches them:
# glibc 2.34-231.amzn2023.0.6 (CVE-2026-86805 HIGH),
# rpm 4.16.1.3-29.amzn2023.0.10 (CVE-2026-103242/84837/95519/95520 HIGH),
# sqlite-libs 3.40.0-1.amzn2023.0.9 (CVE-2026-119371 HIGH).
RUN dnf upgrade -y --releasever=latest glibc glibc-common glibc-langpack-en glibc-minimal-langpack rpm rpm-libs sqlite-libs \
 && dnf clean all

RUN pip install --no-cache-dir \
    numpy==2.4.2 \
    pandas==3.0.1 \
    scipy==1.17.0 \
 && rm -rf /var/lang/bin/pip /var/lang/bin/pip3 /var/lang/bin/pip3.12 \
           /var/lang/lib/python3.12/site-packages/pip \
           /var/lang/lib/python3.12/ensurepip

COPY lib/wrappers/wrapper.py ${LAMBDA_TASK_ROOT}/wrappers/wrapper.py
COPY lib/helpers/helpers.py ${LAMBDA_TASK_ROOT}/src/helpers/helpers.py

# Lambda handler
COPY functions/python/handler.py ${LAMBDA_TASK_ROOT}/handler.py

# The runtime, and with it every macro, runs unprivileged: the files above stay
# read-only to it, so a macro cannot rewrite the helpers for the next batch.
RUN echo "sandbox:x:1001:1001:macro sandbox:/tmp:/sbin/nologin" >> /etc/passwd \
 && echo "sandbox:x:1001:" >> /etc/group
USER 1001

CMD ["handler.handler"]

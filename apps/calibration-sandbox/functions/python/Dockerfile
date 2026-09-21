# Calibration sandbox Lambda

FROM public.ecr.aws/lambda/python:3.12

RUN pip install --no-cache-dir \
    numpy==2.4.2 \
    pandas==3.0.1 \
    scipy==1.17.0 \
 && rm -rf /var/lang/bin/pip /var/lang/bin/pip3 /var/lang/bin/pip3.12 \
           /var/lang/lib/python3.12/site-packages/pip \
           /var/lang/lib/python3.12/ensurepip

COPY lib/wrappers/wrapper.py ${LAMBDA_TASK_ROOT}/wrappers/wrapper.py
COPY lib/helpers/qc.py ${LAMBDA_TASK_ROOT}/src/helpers/qc.py

# Lambda handler
COPY functions/python/handler.py ${LAMBDA_TASK_ROOT}/handler.py

# The runtime, and with it every script, runs unprivileged: the files above stay
# read-only to it, so a script cannot rewrite the gates for whoever calibrates next.
RUN echo "sandbox:x:1001:1001:calibration sandbox:/tmp:/sbin/nologin" >> /etc/passwd \
 && echo "sandbox:x:1001:" >> /etc/group
USER 1001

CMD ["handler.handler"]

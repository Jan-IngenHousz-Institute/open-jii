# Python macro sandbox Lambda

FROM public.ecr.aws/lambda/python:3.12

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

# Python macro sandbox Lambda

FROM public.ecr.aws/lambda/python:3.12

RUN pip install --no-cache-dir \
    numpy==2.4.2 \
    pandas==3.0.1 \
    scipy==1.17.0

COPY lib/wrappers/wrapper.py ${LAMBDA_TASK_ROOT}/wrappers/wrapper.py
COPY lib/helpers/helpers.py ${LAMBDA_TASK_ROOT}/src/helpers/helpers.py

# Lambda handler
COPY functions/python/handler.py ${LAMBDA_TASK_ROOT}/handler.py

CMD ["handler.handler"]

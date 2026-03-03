# ============================================================
# Lambda Function: Python Macro Sandbox
# ============================================================
# Build context: apps/macro-sandbox/
#   docker build -f functions/python/Dockerfile -t macro-sandbox-python .
#
# Runs plant science macros (chlorophyll, SPAD, etc.) using
# numpy, pandas, and scipy. Each invocation = own Firecracker VM.
# ============================================================

FROM public.ecr.aws/lambda/python:3.12

# Scientific computing stack (pinned versions — wheels available for 3.12+)
RUN pip install --no-cache-dir \
    numpy==2.4.2 \
    pandas==3.0.1 \
    scipy==1.17.0

# Wrapper and helpers — matches the path convention wrappers expect:
#   wrapper at ${LAMBDA_TASK_ROOT}/wrappers/wrapper.py
#   helpers at ${LAMBDA_TASK_ROOT}/src/helpers/helpers.py
# Wrappers reference "../src/helpers" relative to their own directory.
COPY lib/wrappers/wrapper.py ${LAMBDA_TASK_ROOT}/wrappers/wrapper.py
COPY lib/helpers/helpers.py ${LAMBDA_TASK_ROOT}/src/helpers/helpers.py

# Lambda handler
COPY functions/python/handler.py ${LAMBDA_TASK_ROOT}/handler.py

CMD ["handler.handler"]

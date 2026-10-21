# Python macro sandbox Lambda

FROM golang:1.26.10@sha256:3745f1aa11822297b79113f5e84ce2bffeb039734571c39855809cfe9e5d7be6 AS rie-builder

ENV GOTOOLCHAIN=local
ARG TARGETARCH
WORKDIR /src
RUN curl -fsSL https://codeload.github.com/aws/aws-lambda-runtime-interface-emulator/tar.gz/c622c06822a4e5390cc71f29df37594646b10700 -o /tmp/rie.tar.gz \
 && echo "94eede130b9f23abfa27460473f5eb93f21a73f03928aa9998e6724316bb4aea  /tmp/rie.tar.gz" | sha256sum -c - \
 && tar -xzf /tmp/rie.tar.gz --strip-components=1 \
 && CGO_ENABLED=0 GOOS=linux GOARCH=${TARGETARCH} go build -mod=readonly -trimpath -buildvcs=false -ldflags '-s -w' -o /aws-lambda-rie ./cmd/aws-lambda-rie

FROM public.ecr.aws/lambda/python:3.12

# Temporary RIE overlay for CVE-2026-111943; remove when AWS ships a fixed RIE.
COPY --from=rie-builder /aws-lambda-rie /usr/local/bin/aws-lambda-rie

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

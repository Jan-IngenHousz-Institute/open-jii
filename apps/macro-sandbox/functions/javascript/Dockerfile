# JavaScript macro sandbox Lambda

FROM golang:1.26.10@sha256:3745f1aa11822297b79113f5e84ce2bffeb039734571c39855809cfe9e5d7be6 AS rie-builder

ENV GOTOOLCHAIN=local
ARG TARGETARCH
WORKDIR /src
RUN curl -fsSL https://codeload.github.com/aws/aws-lambda-runtime-interface-emulator/tar.gz/c622c06822a4e5390cc71f29df37594646b10700 -o /tmp/rie.tar.gz \
 && echo "94eede130b9f23abfa27460473f5eb93f21a73f03928aa9998e6724316bb4aea  /tmp/rie.tar.gz" | sha256sum -c - \
 && tar -xzf /tmp/rie.tar.gz --strip-components=1 \
 && CGO_ENABLED=0 GOOS=linux GOARCH=${TARGETARCH} go build -mod=readonly -trimpath -buildvcs=false -ldflags '-s -w' -o /aws-lambda-rie ./cmd/aws-lambda-rie

RUN curl -fsSL https://registry.npmjs.org/follow-redirects/-/follow-redirects-1.16.1.tgz -o /tmp/follow-redirects.tgz \
 && echo "6e075d999dc5ff568916954508397b11a537b18bde615986d7bd8b3d3fa1799f  /tmp/follow-redirects.tgz" | sha256sum -c - \
 && mkdir /follow-redirects \
 && tar -xzf /tmp/follow-redirects.tgz -C /follow-redirects --strip-components=1

FROM public.ecr.aws/lambda/nodejs:24

# Temporary RIE overlay for CVE-2026-111943; remove when AWS ships a fixed RIE.
COPY --from=rie-builder /aws-lambda-rie /usr/local/bin/aws-lambda-rie

# Temporary follow-redirects overlay; remove when AWS ships 1.16.1 or newer.
RUN rm -rf /var/runtime/node_modules/@aws-sdk/node_modules/follow-redirects
COPY --from=rie-builder /follow-redirects/ /var/runtime/node_modules/@aws-sdk/node_modules/follow-redirects/

# Remove npm/corepack so sandbox code cannot install packages.
RUN rm -rf /var/lang/lib/node_modules/npm /var/lang/lib/node_modules/corepack \
           /var/lang/bin/npm /var/lang/bin/npx /var/lang/bin/corepack

# Wrapper and helpers
COPY lib/wrappers/wrapper.js ${LAMBDA_TASK_ROOT}/wrappers/wrapper.js
COPY lib/helpers/helpers.js ${LAMBDA_TASK_ROOT}/src/helpers/helpers.js

# Lambda handler
COPY functions/javascript/handler.js ${LAMBDA_TASK_ROOT}/handler.js

CMD ["handler.handler"]

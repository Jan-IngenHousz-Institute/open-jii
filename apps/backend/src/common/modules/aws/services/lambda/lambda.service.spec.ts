import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { mockClient } from "aws-sdk-client-mock";
import * as zlib from "node:zlib";

import { TestHarness } from "../../../../../test/test-harness";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import { AwsLambdaService } from "./lambda.service";

const lambdaMock = mockClient(LambdaClient);

describe("AwsLambdaService", () => {
  const testApp = TestHarness.App;
  let service: AwsLambdaService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    lambdaMock.reset();
    await testApp.beforeEach();
    service = testApp.module.get(AwsLambdaService);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("invoke", () => {
    it("should return a success result when Lambda responds with a valid payload", async () => {
      const responsePayload = { result: "ok", val: 42 };

      lambdaMock.on(InvokeCommand).resolves({
        StatusCode: 200,
        Payload: new TextEncoder().encode(JSON.stringify(responsePayload)),
      });

      const result = await service.invoke({
        functionName: "my-function",
        payload: { hello: "world" },
      });

      assertSuccess(result);
      expect(result.value.statusCode).toBe(200);
      expect(result.value.payload).toEqual(responsePayload);
      expect(result.value.functionError).toBeUndefined();
      expect(lambdaMock.commandCalls(InvokeCommand)).toHaveLength(1);
    });

    it("should default to empty object when Lambda returns no Payload", async () => {
      lambdaMock.on(InvokeCommand).resolves({
        StatusCode: 204,
      });

      const result = await service.invoke({
        functionName: "my-function",
        payload: {},
      });

      assertSuccess(result);
      expect(result.value.statusCode).toBe(204);
      expect(result.value.payload).toEqual({});
    });

    it("should default StatusCode to 200 when not present in response", async () => {
      lambdaMock.on(InvokeCommand).resolves({
        Payload: new TextEncoder().encode(JSON.stringify({ ok: true })),
      });

      const result = await service.invoke({
        functionName: "my-function",
        payload: {},
      });

      assertSuccess(result);
      expect(result.value.statusCode).toBe(200);
    });

    it("should return failure when Lambda response contains FunctionError", async () => {
      lambdaMock.on(InvokeCommand).resolves({
        StatusCode: 200,
        Payload: new TextEncoder().encode(JSON.stringify({ error: "boom" })),
        FunctionError: "Unhandled",
      });

      const result = await service.invoke({
        functionName: "my-function",
        payload: {},
      });

      assertFailure(result);
      expect(result.error.message).toContain("Lambda function error");
      expect(result.error.message).toContain("Unhandled");
      expect(result.error.code).toBe("AWS_OPERATION_FAILED");
    });

    it("should map SDK errors to failure with AWS_OPERATION_FAILED code", async () => {
      lambdaMock.on(InvokeCommand).rejects(new Error("Network timeout"));

      const result = await service.invoke({
        functionName: "my-function",
        payload: { hello: "world" },
      });

      assertFailure(result);
      expect(result.error.message).toBe("Network timeout");
      expect(result.error.code).toBe("AWS_OPERATION_FAILED");
    });

    it("wraps non-Error throws from the SDK into AWS_OPERATION_FAILED", async () => {
      lambdaMock.on(InvokeCommand).callsFake(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw "something unexpected";
      });

      const result = await service.invoke({
        functionName: "my-function",
        payload: {},
      });

      assertFailure(result);
      expect(result.error.message).toBe("something unexpected");
      expect(result.error.code).toBe("AWS_OPERATION_FAILED");
    });

    it("should pass invocationType through to the SDK command", async () => {
      lambdaMock.on(InvokeCommand).resolves({
        StatusCode: 202,
        Payload: new TextEncoder().encode(JSON.stringify({})),
      });

      const result = await service.invoke({
        functionName: "my-function",
        payload: { test: true },
        invocationType: "Event",
      });

      assertSuccess(result);
      expect(result.value.statusCode).toBe(202);

      const calls = lambdaMock.commandCalls(InvokeCommand);
      expect(calls[0].args[0].input).toEqual(
        expect.objectContaining({
          FunctionName: "my-function",
          InvocationType: "Event",
        }),
      );
    });

    it("should default invocationType to RequestResponse", async () => {
      lambdaMock.on(InvokeCommand).resolves({
        StatusCode: 200,
        Payload: new TextEncoder().encode(JSON.stringify({})),
      });

      await service.invoke({
        functionName: "my-function",
        payload: {},
      });

      const calls = lambdaMock.commandCalls(InvokeCommand);
      expect(calls[0].args[0].input).toEqual(
        expect.objectContaining({ InvocationType: "RequestResponse" }),
      );
    });

    it("should decompress payloads wrapped as {encoding: gzip+base64, payload}", async () => {
      const originalEnvelope = {
        status: "success",
        results: [{ id: "item-1", success: true, output: { foo: "bar" } }],
      };
      const compressed = zlib.gzipSync(JSON.stringify(originalEnvelope)).toString("base64");

      lambdaMock.on(InvokeCommand).resolves({
        StatusCode: 200,
        Payload: new TextEncoder().encode(
          JSON.stringify({ encoding: "gzip+base64", payload: compressed }),
        ),
      });

      const result = await service.invoke({
        functionName: "my-function",
        payload: {},
      });

      assertSuccess(result);
      expect(result.value.payload).toEqual(originalEnvelope);
    });

    it("should pass through non-compressed payloads unchanged (legacy compat)", async () => {
      const responsePayload = { status: "success", results: [], extra: 123 };

      lambdaMock.on(InvokeCommand).resolves({
        StatusCode: 200,
        Payload: new TextEncoder().encode(JSON.stringify(responsePayload)),
      });

      const result = await service.invoke({
        functionName: "my-function",
        payload: {},
      });

      assertSuccess(result);
      expect(result.value.payload).toEqual(responsePayload);
    });

    it("should apply the decompression cap", async () => {
      // 60 MB of repeated zeros
      const huge = Buffer.alloc(60 * 1024 * 1024, 0);
      const compressed = zlib.gzipSync(huge).toString("base64");

      lambdaMock.on(InvokeCommand).resolves({
        StatusCode: 200,
        Payload: new TextEncoder().encode(
          JSON.stringify({ encoding: "gzip+base64", payload: compressed }),
        ),
      });

      const result = await service.invoke({
        functionName: "my-function",
        payload: {},
      });

      assertFailure(result);
      expect(result.error.code).toBe("AWS_OPERATION_FAILED");
    });
  });

  describe("local endpoint", () => {
    const LOCAL = "http://localhost:9004";
    const emptyPayload = () => new TextEncoder().encode(JSON.stringify({}));

    function clientBehind(callIndex: number): LambdaClient {
      const client: unknown = lambdaMock.commandCalls(InvokeCommand)[callIndex].thisValue;
      if (!(client instanceof LambdaClient)) {
        throw new Error("InvokeCommand was not sent through a LambdaClient");
      }
      return client;
    }

    it("sends the invoke through a client bound to the endpoint, once, with placeholder credentials", async () => {
      lambdaMock.on(InvokeCommand).resolves({ StatusCode: 200, Payload: emptyPayload() });

      const result = await service.invoke({
        functionName: "function",
        payload: {},
        endpoint: LOCAL,
      });

      assertSuccess(result);
      const client = clientBehind(0);
      await expect(client.config.endpoint?.()).resolves.toEqual(
        expect.objectContaining({ hostname: "localhost", port: 9004 }),
      );
      await expect(client.config.maxAttempts()).resolves.toBe(1);
      await expect(client.config.credentials()).resolves.toEqual(
        expect.objectContaining({ accessKeyId: "local" }),
      );
    });

    it("reuses one client per endpoint and keeps AWS invokes on the default client", async () => {
      lambdaMock.on(InvokeCommand).resolves({ StatusCode: 200, Payload: emptyPayload() });

      await service.invoke({ functionName: "function", payload: {}, endpoint: LOCAL });
      await service.invoke({ functionName: "function", payload: {}, endpoint: LOCAL });
      await service.invoke({
        functionName: "function",
        payload: {},
        endpoint: "http://localhost:9005",
      });
      await service.invoke({ functionName: "my-function", payload: {} });

      expect(clientBehind(1)).toBe(clientBehind(0));
      expect(clientBehind(2)).not.toBe(clientBehind(0));
      expect(clientBehind(3)).not.toBe(clientBehind(0));
      await expect(clientBehind(3).config.maxAttempts()).resolves.toBe(5);
    });

    it("explains a refused connection to a local endpoint", async () => {
      lambdaMock
        .on(InvokeCommand)
        .rejects(
          Object.assign(new Error("connect ECONNREFUSED ::1:9004"), { code: "ECONNREFUSED" }),
        );

      const result = await service.invoke({
        functionName: "function",
        payload: {},
        endpoint: LOCAL,
      });

      assertFailure(result);
      expect(result.error.message).toBe(
        `Lambda endpoint ${LOCAL} refused the connection; is the local container running?`,
      );
      expect(result.error.code).toBe("AWS_OPERATION_FAILED");
    });

    it("leaves a refused connection to AWS as the SDK reported it", async () => {
      lambdaMock
        .on(InvokeCommand)
        .rejects(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }));

      const result = await service.invoke({ functionName: "my-function", payload: {} });

      assertFailure(result);
      expect(result.error.message).toBe("connect ECONNREFUSED");
    });
  });
});

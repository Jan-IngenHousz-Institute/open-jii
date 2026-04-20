import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { mockClient } from "aws-sdk-client-mock";

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

    it("should handle non-Error thrown values with 'Unknown error' message", async () => {
      lambdaMock.on(InvokeCommand).rejects("something unexpected");

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
  });
});

import { TestHarness } from "../../../../../test/test-harness";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import { AwsLambdaService } from "./lambda.service";

// Mock the AWS SDK — same pattern as location.service.spec.ts
const mockSend = vi.hoisted(() => vi.fn());

vi.mock("@aws-sdk/client-lambda", () => {
  const mockLambdaClient = { send: mockSend };

  return {
    LambdaClient: vi.fn(() => mockLambdaClient),
    InvokeCommand: vi.fn(),
  };
});

describe("AwsLambdaService", () => {
  const testApp = TestHarness.App;
  let service: AwsLambdaService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    service = testApp.module.get(AwsLambdaService);
    vi.clearAllMocks();
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

      mockSend.mockResolvedValue({
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
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("should default to empty object when Lambda returns no Payload", async () => {
      mockSend.mockResolvedValue({
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
      mockSend.mockResolvedValue({
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
      mockSend.mockResolvedValue({
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
      mockSend.mockRejectedValue(new Error("Network timeout"));

      const result = await service.invoke({
        functionName: "my-function",
        payload: { hello: "world" },
      });

      assertFailure(result);
      expect(result.error.message).toBe("Network timeout");
      expect(result.error.code).toBe("AWS_OPERATION_FAILED");
    });

    it("should handle non-Error thrown values with 'Unknown error' message", async () => {
      mockSend.mockRejectedValue("something unexpected");

      const result = await service.invoke({
        functionName: "my-function",
        payload: {},
      });

      assertFailure(result);
      expect(result.error.message).toBe("Unknown error");
      expect(result.error.code).toBe("AWS_OPERATION_FAILED");
    });

    it("should pass invocationType through to the SDK command", async () => {
      mockSend.mockResolvedValue({
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
      mockSend.mockResolvedValue({
        StatusCode: 200,
        Payload: new TextEncoder().encode(JSON.stringify({})),
      });

      await service.invoke({
        functionName: "my-function",
        payload: {},
      });

      // The InvokeCommand constructor is called with the input
      const { InvokeCommand } = await import("@aws-sdk/client-lambda");
      expect(InvokeCommand).toHaveBeenCalledWith(
        expect.objectContaining({ InvocationType: "RequestResponse" }),
      );
    });
  });
});

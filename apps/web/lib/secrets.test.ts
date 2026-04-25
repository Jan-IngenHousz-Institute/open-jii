import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchSecret, getSecret, isLambdaEnvironment } from "./secrets";

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock("http", () => ({
  default: { get: mockGet },
  get: mockGet,
}));

function makeMockResponse(statusCode: number, body: string) {
  const res = {
    statusCode,
    on: vi.fn((event: string, handler: (data?: unknown) => void) => {
      if (event === "data") handler(body);
      if (event === "end") handler();
      return res;
    }),
  };
  return res;
}

function makeRequest() {
  return { on: vi.fn().mockReturnThis() };
}

describe("isLambdaEnvironment", () => {
  it("returns false when AWS_LAMBDA_FUNCTION_NAME is not set", () => {
    vi.stubEnv("AWS_LAMBDA_FUNCTION_NAME", "");
    expect(isLambdaEnvironment()).toBe(false);
    vi.unstubAllEnvs();
  });

  it("returns true when AWS_LAMBDA_FUNCTION_NAME is set", () => {
    vi.stubEnv("AWS_LAMBDA_FUNCTION_NAME", "my-function");
    expect(isLambdaEnvironment()).toBe(true);
    vi.unstubAllEnvs();
  });
});

describe("fetchSecret", () => {
  beforeEach(() => {
    vi.stubEnv("AWS_LAMBDA_FUNCTION_NAME", "my-function");
    vi.stubEnv("AWS_SESSION_TOKEN", "test-token");
    vi.clearAllMocks();
    // Tests below exercise retry/failure paths that log via console.error.
    vi.spyOn(console, "error").mockImplementation(() => {
      // no-op
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns empty object in non-Lambda environment", async () => {
    vi.stubEnv("AWS_LAMBDA_FUNCTION_NAME", "");
    const result = await fetchSecret("arn:aws:secretsmanager:us-east-1:123:secret:test");
    expect(result).toEqual({});
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("fetches and returns parsed secret on success", async () => {
    const secret = { CONTENTFUL_SPACE_ID: "space123", CONTENTFUL_ACCESS_TOKEN: "token456" };
    const body = JSON.stringify({ SecretString: JSON.stringify(secret) });
    const req = makeRequest();
    mockGet.mockImplementation((_opts: unknown, cb: (res: unknown) => void) => {
      cb(makeMockResponse(200, body));
      return req;
    });

    const result = await fetchSecret("arn:aws:secretsmanager:us-east-1:123:secret:unique1");
    expect(result).toEqual(secret);
  });

  it("returns cached value on second call", async () => {
    const secret = { CONTENTFUL_SPACE_ID: "cached" };
    const body = JSON.stringify({ SecretString: JSON.stringify(secret) });
    const req = makeRequest();
    mockGet.mockImplementation((_opts: unknown, cb: (res: unknown) => void) => {
      cb(makeMockResponse(200, body));
      return req;
    });

    const arn = "arn:aws:secretsmanager:us-east-1:123:secret:unique2";
    await fetchSecret(arn);
    await fetchSecret(arn);
    expect(mockGet).toHaveBeenCalledTimes(1); // second call uses cache
  });

  it("retries on ECONNRESET and succeeds on retry", async () => {
    vi.useFakeTimers();
    const secret = { CONTENTFUL_ACCESS_TOKEN: "retried" };
    const body = JSON.stringify({ SecretString: JSON.stringify(secret) });
    const req = makeRequest();

    let callCount = 0;
    mockGet.mockImplementation((_opts: unknown, cb: (res: unknown) => void) => {
      callCount++;
      if (callCount === 1) {
        // First call: emit error
        const errReq = {
          on: vi.fn((event: string, handler: (err: Error) => void) => {
            if (event === "error") handler(new Error("ECONNRESET"));
            return errReq;
          }),
        };
        return errReq;
      }
      cb(makeMockResponse(200, body));
      return req;
    });

    const fetchPromise = fetchSecret("arn:aws:secretsmanager:us-east-1:123:secret:unique3");
    await vi.advanceTimersByTimeAsync(300);
    const result = await fetchPromise;

    expect(result).toEqual(secret);
    expect(callCount).toBe(2);
    vi.useRealTimers();
  });

  it("returns empty object after all retries fail", async () => {
    vi.useFakeTimers();
    const req = {
      on: vi.fn((event: string, handler: (err: Error) => void) => {
        if (event === "error") handler(new Error("ECONNRESET"));
        return req;
      }),
    };
    mockGet.mockReturnValue(req);

    const fetchPromise = fetchSecret("arn:aws:secretsmanager:us-east-1:123:secret:unique4");
    await vi.advanceTimersByTimeAsync(2000);
    const result = await fetchPromise;

    expect(result).toEqual({});
    expect(mockGet).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    vi.useRealTimers();
  });

  it("does not cache failed fetches", async () => {
    vi.useFakeTimers();
    const req = {
      on: vi.fn((event: string, handler: (err: Error) => void) => {
        if (event === "error") handler(new Error("ECONNRESET"));
        return req;
      }),
    };
    mockGet.mockReturnValue(req);

    const arn = "arn:aws:secretsmanager:us-east-1:123:secret:unique5";
    const fetchPromise = fetchSecret(arn);
    await vi.advanceTimersByTimeAsync(2000);
    await fetchPromise;

    // Second call should attempt again, not return cached empty
    mockGet.mockClear();
    const secret = { KEY: "value" };
    const body = JSON.stringify({ SecretString: JSON.stringify(secret) });
    const req2 = makeRequest();
    mockGet.mockImplementation((_opts: unknown, cb: (res: unknown) => void) => {
      cb(makeMockResponse(200, body));
      return req2;
    });

    const result = await fetchSecret(arn);
    expect(result).toEqual(secret);
    vi.useRealTimers();
  });

  it("returns empty object on non-200 response", async () => {
    vi.useFakeTimers();
    const req = makeRequest();
    mockGet.mockImplementation((_opts: unknown, cb: (res: unknown) => void) => {
      cb(makeMockResponse(403, "Forbidden"));
      return req;
    });

    const fetchPromise = fetchSecret("arn:aws:secretsmanager:us-east-1:123:secret:unique6");
    await vi.advanceTimersByTimeAsync(2000);
    const result = await fetchPromise;
    expect(result).toEqual({});
    vi.useRealTimers();
  });
});

describe("getSecret", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns empty object in non-Lambda environment", async () => {
    vi.stubEnv("AWS_LAMBDA_FUNCTION_NAME", "");
    expect(await getSecret("arn:test")).toEqual({});
  });

  it("returns undefined for key in non-Lambda environment", async () => {
    vi.stubEnv("AWS_LAMBDA_FUNCTION_NAME", "");
    expect(await getSecret("arn:test", "KEY")).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";

import {
  zExperimentCreateJoinRequestBody,
  zExperimentJoinRequest,
  zExperimentJoinRequestList,
  zExperimentJoinRequestPathParam,
  zExperimentJoinRequestStatus,
} from "./experiment-join-requests.schema";

describe("zExperimentJoinRequestStatus", () => {
  it("accepts each valid status", () => {
    ["pending", "approved", "rejected", "cancelled"].forEach((s) =>
      expect(zExperimentJoinRequestStatus.parse(s)).toBe(s),
    );
  });

  it("rejects an unknown status", () => {
    expect(() => zExperimentJoinRequestStatus.parse("expired")).toThrow();
  });
});

describe("zExperimentJoinRequest", () => {
  const request = {
    id: "11111111-1111-1111-1111-111111111111",
    experimentId: "22222222-2222-2222-2222-222222222222",
    user: {
      id: "33333333-3333-3333-3333-333333333333",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      avatarUrl: null,
    },
    message: null,
    status: "pending" as const,
    decidedBy: null,
    decidedAt: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  it("accepts a valid request", () => {
    expect(zExperimentJoinRequest.parse(request)).toEqual(request);
  });

  it("accepts a decided request with a message", () => {
    const decided = {
      ...request,
      message: "please let me in",
      status: "approved" as const,
      decidedBy: "44444444-4444-4444-4444-444444444444",
      decidedAt: "2024-01-02T00:00:00.000Z",
    };
    expect(zExperimentJoinRequest.parse(decided)).toEqual(decided);
  });

  it("rejects a malformed email", () => {
    const bad = { ...request, user: { ...request.user, email: "nope" } };
    expect(() => zExperimentJoinRequest.parse(bad)).toThrow();
  });

  it("accepts a list of requests", () => {
    expect(zExperimentJoinRequestList.parse([request])).toEqual([request]);
  });
});

describe("zExperimentCreateJoinRequestBody", () => {
  it("accepts an omitted message", () => {
    expect(zExperimentCreateJoinRequestBody.parse({})).toEqual({});
  });

  it("accepts a message within the length cap", () => {
    expect(zExperimentCreateJoinRequestBody.parse({ message: "hi" })).toEqual({ message: "hi" });
  });

  it("rejects a message over 250 characters", () => {
    expect(() => zExperimentCreateJoinRequestBody.parse({ message: "x".repeat(251) })).toThrow();
  });
});

describe("zExperimentJoinRequestPathParam", () => {
  it("accepts valid experiment + request ids", () => {
    const ok = {
      id: "55555555-5555-5555-5555-555555555555",
      requestId: "66666666-6666-6666-6666-666666666666",
    };
    expect(zExperimentJoinRequestPathParam.parse(ok)).toEqual(ok);
  });

  it("rejects a non-uuid requestId", () => {
    expect(() =>
      zExperimentJoinRequestPathParam.parse({
        id: "55555555-5555-5555-5555-555555555555",
        requestId: "x",
      }),
    ).toThrow();
  });
});

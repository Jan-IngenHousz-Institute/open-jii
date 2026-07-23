import { describe, expect, it } from "vitest";

import {
  zExperimentCreateTransferRequestBody,
  zExperimentTransferRequest,
  zExperimentTransferRequestList,
  zExperimentTransferRequestStatus,
} from "./experiment-transfer-requests.schema";

describe("zExperimentTransferRequestStatus", () => {
  it("accepts each valid status", () => {
    ["pending", "approved", "partial_failed", "completed", "rejected", "failed"].forEach((s) =>
      expect(zExperimentTransferRequestStatus.parse(s)).toBe(s),
    );
  });

  it("rejects an unknown status", () => {
    expect(() => zExperimentTransferRequestStatus.parse("cancelled")).toThrow();
  });
});

describe("zExperimentTransferRequest", () => {
  const request = {
    requestId: "11111111-1111-1111-1111-111111111111",
    userId: "22222222-2222-2222-2222-222222222222",
    userEmail: "user@example.com",
    sourcePlatform: "legacy",
    projectIdOld: "proj-1",
    projectUrlOld: "https://legacy.example.com/proj-1",
    status: "pending" as const,
    requestedAt: "2024-01-01T00:00:00.000Z",
  };

  it("accepts a valid request", () => {
    expect(zExperimentTransferRequest.parse(request)).toEqual(request);
  });

  it("rejects a malformed email", () => {
    expect(() => zExperimentTransferRequest.parse({ ...request, userEmail: "nope" })).toThrow();
  });

  it("rejects a non-url old project url", () => {
    expect(() => zExperimentTransferRequest.parse({ ...request, projectUrlOld: "nope" })).toThrow();
  });

  it("accepts a list of requests", () => {
    expect(zExperimentTransferRequestList.parse([request])).toEqual([request]);
  });
});

describe("zExperimentCreateTransferRequestBody", () => {
  it("accepts a valid body and trims the project id", () => {
    const parsed = zExperimentCreateTransferRequestBody.parse({
      projectIdOld: "  proj-1  ",
      projectUrlOld: "https://legacy.example.com/proj-1",
    });
    expect(parsed.projectIdOld).toBe("proj-1");
  });

  it("rejects an empty project id", () => {
    expect(() =>
      zExperimentCreateTransferRequestBody.parse({
        projectIdOld: "",
        projectUrlOld: "https://legacy.example.com/proj-1",
      }),
    ).toThrow();
  });

  it("rejects an invalid project url", () => {
    expect(() =>
      zExperimentCreateTransferRequestBody.parse({ projectIdOld: "proj-1", projectUrlOld: "nope" }),
    ).toThrow();
  });
});

import { describe, expect, it } from "vitest";

import { uploadFailureCategory } from "./upload-failure-category";

describe("uploadFailureCategory", () => {
  it("reads a lost connection from every transport-level kind", () => {
    expect(uploadFailureCategory("Timeout")).toBe("connection");
    expect(uploadFailureCategory("Disconnected")).toBe("connection");
    expect(uploadFailureCategory("PublishError")).toBe("connection");
  });

  it("separates a credential failure from a connection one", () => {
    expect(uploadFailureCategory("CredentialError")).toBe("credentials");
  });

  it("separates losing access to the experiment from every other failure", () => {
    expect(uploadFailureCategory("Forbidden")).toBe("permission");
    expect(uploadFailureCategory("NotFound")).toBe("permission");
  });

  it("reads a refused upload as rejected rather than as a connection problem", () => {
    expect(uploadFailureCategory("Rejected")).toBe("rejected");
    expect(uploadFailureCategory("NoExperiment")).toBe("rejected");
  });

  it("reads the large-upload network kind as a connection problem too", () => {
    expect(uploadFailureCategory("Network")).toBe("connection");
  });

  it("falls back to unknown for a kind it does not recognise", () => {
    expect(uploadFailureCategory("SomethingNew")).toBe("unknown");
  });

  it("falls back to unknown when the row stored no kind", () => {
    expect(uploadFailureCategory(null)).toBe("unknown");
    expect(uploadFailureCategory("")).toBe("unknown");
  });
});

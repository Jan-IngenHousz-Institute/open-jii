import { describe, expect, it } from "vitest";
import enUS from "~/shared/i18n/locales/en-US/recent-measurements.json";
import nlNL from "~/shared/i18n/locales/nl-NL/recent-measurements.json";

import {
  UPLOAD_FAILURE_MESSAGE_KEYS,
  uploadFailureCategory,
  uploadFailureMessageKey,
} from "./upload-failure-category";

function hasKey(bundle: Record<string, unknown>, path: string): boolean {
  const value = path.split(".").reduce<unknown>((node, segment) => {
    return node && typeof node === "object"
      ? (node as Record<string, unknown>)[segment]
      : undefined;
  }, bundle);
  return typeof value === "string" && value.length > 0;
}

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

  it("reads a dead session as a credential problem, whichever transport saw it", () => {
    expect(uploadFailureCategory("Unauthenticated")).toBe("credentials");
  });

  it("falls back to unknown for a kind it does not recognise", () => {
    expect(uploadFailureCategory("SomethingNew")).toBe("unknown");
  });

  it("falls back to unknown when the row stored no kind", () => {
    expect(uploadFailureCategory(null)).toBe("unknown");
    expect(uploadFailureCategory("")).toBe("unknown");
  });
});

describe("uploadFailureMessageKey", () => {
  it("qualifies every category with the recentMeasurements namespace", () => {
    for (const key of Object.values(UPLOAD_FAILURE_MESSAGE_KEYS)) {
      expect(key.startsWith("recentMeasurements:failureReason.")).toBe(true);
    }
  });

  // A key chosen through a lookup is invisible to a grep-based coverage check,
  // so the enumeration is asserted against both locales here instead.
  it.each(Object.entries(UPLOAD_FAILURE_MESSAGE_KEYS))(
    "%s resolves in every maintained locale",
    (_category, key) => {
      const path = key.replace("recentMeasurements:", "");

      expect(hasKey(enUS, path)).toBe(true);
      expect(hasKey(nlNL, path)).toBe(true);
    },
  );

  it("maps a stored kind straight to its key", () => {
    expect(uploadFailureMessageKey("CredentialError")).toBe(
      UPLOAD_FAILURE_MESSAGE_KEYS.credentials,
    );
    expect(uploadFailureMessageKey(null)).toBe(UPLOAD_FAILURE_MESSAGE_KEYS.unknown);
  });
});

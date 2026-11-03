import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import { workbookPinError } from "./workbook-pin-error";

describe("workbook pin error", () => {
  it("localizes the server conflict using only its production-safe error code", () => {
    const error = new ORPCError("BAD_REQUEST", {
      message: "Server detail",
      data: { code: "QUESTION_TYPE_CHANGE" },
    });
    expect(workbookPinError(error, "fallback", "Localized new-name instruction", "duplicate")).toBe(
      "Localized new-name instruction",
    );
  });
  it("localizes duplicate canonical keys without relying on server details", () => {
    const error = new ORPCError("BAD_REQUEST", {
      message: "English duplicate detail",
      data: { code: "DUPLICATE_QUESTION_KEY" },
    });
    expect(
      workbookPinError(error, "fallback", "type conflict", "Localized unique-name instruction"),
    ).toBe("Localized unique-name instruction");
  });
  it("preserves the message for other bad requests", () => {
    const error = new ORPCError("BAD_REQUEST", {
      message: "Other validation",
      data: { code: "BAD_REQUEST" },
    });
    expect(workbookPinError(error, "fallback", "conflict", "duplicate")).toBe("Other validation");
  });
  it("keeps unrelated errors on the normal error path", () => {
    expect(
      workbookPinError(new Error("Internal detail"), "fallback", "conflict", "duplicate"),
    ).toBe("fallback");
  });
});

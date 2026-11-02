import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import { workbookPinError } from "./workbook-pin-error";

describe("workbook pin error", () => {
  it("localizes the server conflict using only its production-safe error code", () => {
    const error = new ORPCError("BAD_REQUEST", {
      message: "Server detail",
      data: { code: "QUESTION_TYPE_CHANGE" },
    });
    expect(workbookPinError(error, "fallback", "Localized new-name instruction")).toBe(
      "Localized new-name instruction",
    );
  });
  it("keeps unrelated errors on the normal error path", () => {
    expect(workbookPinError(new Error("Internal detail"), "fallback", "conflict")).toBe("fallback");
  });
});

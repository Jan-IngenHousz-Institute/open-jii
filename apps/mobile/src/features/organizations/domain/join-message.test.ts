import { describe, expect, it } from "vitest";
import {
  JOIN_MESSAGE_MAX_LENGTH,
  normalizeJoinMessage,
} from "~/features/organizations/domain/join-message";

import { zCreateOrganizationJoinRequestBody } from "@repo/api/domains/organization/join-requests/organization-join-requests.schema";

describe("JOIN_MESSAGE_MAX_LENGTH", () => {
  it("is the contract's own maximum, so the counter and the server agree", () => {
    expect(JOIN_MESSAGE_MAX_LENGTH).toBe(250);

    const tooLong = "x".repeat(JOIN_MESSAGE_MAX_LENGTH + 1);
    expect(zCreateOrganizationJoinRequestBody.safeParse({ message: tooLong }).success).toBe(false);
    expect(
      zCreateOrganizationJoinRequestBody.safeParse({ message: tooLong.slice(0, -1) }).success,
    ).toBe(true);
  });
});

describe("normalizeJoinMessage", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeJoinMessage("  Tuesday BSc practical  ")).toBe("Tuesday BSc practical");
  });

  it("turns a whitespace-only message into no message", () => {
    expect(normalizeJoinMessage("   \n\t ")).toBeUndefined();
  });

  it("turns an empty message into no message", () => {
    expect(normalizeJoinMessage("")).toBeUndefined();
  });

  it("passes through an absent message", () => {
    expect(normalizeJoinMessage(undefined)).toBeUndefined();
    expect(normalizeJoinMessage(null)).toBeUndefined();
  });
});

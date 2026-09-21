import { describe, expect, it } from "vitest";

import {
  zAssistantKnowledgeCapabilityErrorCode,
  zAssistantKnowledgeCitation,
  zCorpusWork,
  zCreateCorpusWorkInput,
  zAssistantKnowledgeSearchInput,
  zCorpusRights,
  zReviewCorpusWorkInput,
  zListCorpusWorksInput,
} from "./assistant-knowledge.schema";

describe("assistant knowledge schemas", () => {
  it.each([
    { input: undefined, expected: false },
    { input: false, expected: false },
    { input: true, expected: true },
    { input: "false", expected: false },
    { input: "true", expected: true },
  ])("parses corpus list includeRemoved $input as $expected", ({ input, expected }) => {
    expect(zListCorpusWorksInput.parse({ includeRemoved: input }).includeRemoved).toBe(expected);
  });

  it.each(["0", "1", "yes", "FALSE", "", null, 0, 1])(
    "rejects ambiguous corpus list boolean %s",
    (includeRemoved) => {
      expect(zListCorpusWorksInput.safeParse({ includeRemoved }).success).toBe(false);
    },
  );

  it.each([
    { sourceUrl: "javascript:alert(1)", allowed: false },
    { sourceUrl: "data:text/html,<script>alert(1)</script>", allowed: false },
    { sourceUrl: "ftp://papers.example/study.pdf", allowed: false },
    { sourceUrl: "https://papers.example/study.pdf", allowed: true },
    { sourceUrl: "http://papers.example/study.pdf", allowed: true },
    { sourceUrl: null, allowed: true },
  ])(
    "validates source URL $sourceUrl across create, stored work and citation schemas",
    ({ sourceUrl, allowed }) => {
      expect(zCorpusWork.pick({ sourceUrl: true }).safeParse({ sourceUrl }).success).toBe(allowed);
      expect(
        zAssistantKnowledgeCitation.pick({ sourceUrl: true }).safeParse({ sourceUrl }).success,
      ).toBe(allowed);
      expect(
        zCreateCorpusWorkInput.safeParse({
          organizationId: "123e4567-e89b-12d3-a456-426614174000",
          title: "A paper",
          authors: ["Example Author"],
          year: 2026,
          sourceUrl,
        }).success,
      ).toBe(allowed && sourceUrl !== null);
    },
  );

  it("allows an omitted source URL when creating a corpus work", () => {
    expect(
      zCreateCorpusWorkInput.safeParse({
        organizationId: "123e4567-e89b-12d3-a456-426614174000",
        title: "A paper",
        authors: ["Example Author"],
        year: 2026,
      }).success,
    ).toBe(true);
  });

  it("keeps platform and external-public rights decisions separate", () => {
    const result = zCorpusRights.safeParse({
      status: "approved",
      basis: "open-access",
      licenceId: "CC-BY-4.0",
      licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
      attribution: "Example Author (2026)",
      reviewedBy: "123e4567-e89b-12d3-a456-426614174000",
      reviewedAt: "2026-09-21T12:00:00.000Z",
      externalPublicStatus: "pending",
      externalPublicReviewedBy: null,
      externalPublicReviewedAt: null,
    });

    expect(result.success).toBe(true);
  });

  it("requires a concrete rights record when reviewing a work", () => {
    const result = zReviewCorpusWorkInput.safeParse({
      workId: "123e4567-e89b-12d3-a456-426614174000",
      parseDecision: "accepted",
      rightsDecision: "approved",
      externalPublicDecision: "pending",
      rights: {
        basis: "open-access",
        licenceId: "CC-BY-4.0",
        licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
        attribution: "Example Author (2026)",
      },
    });

    expect(result.success).toBe(true);
  });

  it("caps search result requests", () => {
    expect(
      zAssistantKnowledgeSearchInput.safeParse({ query: "photosynthesis", limit: 21 }).success,
    ).toBe(false);
  });

  it("represents configured but unwired Genie as unavailable", () => {
    expect(zAssistantKnowledgeCapabilityErrorCode.parse("GENIE_TOOL_UNAVAILABLE")).toBe(
      "GENIE_TOOL_UNAVAILABLE",
    );
  });
});

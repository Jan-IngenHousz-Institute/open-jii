import { fromPartial } from "@total-typescript/shoehorn";
import { describe, expect, it, vi } from "vitest";

import { zAssistantKnowledgeSearchResponse } from "@repo/api/domains/assistant-knowledge/assistant-knowledge.schema";

import { success } from "../../common/utils/fp-utils";
import { AssistantToolService } from "./assistant-tool.service";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const SOURCE_ID = "00000000-0000-4000-8000-000000000002";

describe("AssistantToolService", () => {
  it.each(["http://localhost:3010/guide", "https://docs.dev.openjii.org/guide", null])(
    "gives the model the absolute docs URL %s while keeping stored chips portable",
    async (docsUrl) => {
      const knowledgeResult = zAssistantKnowledgeSearchResponse.parse({
        hits: [
          {
            citation: {
              sourceType: "docs",
              sourceId: "docs:guide/index.mdx",
              title: "Guide",
              route: "/guide",
              sourceUrl: docsUrl,
              year: null,
              page: null,
              licenceId: null,
            },
            excerpt: "Create an experiment",
            score: 1,
          },
          {
            citation: {
              sourceType: "corpus",
              sourceId: SOURCE_ID,
              title: "Paper",
              route: `/platform/assistant/corpus/${SOURCE_ID}`,
              sourceUrl: "https://paper.example/study",
              year: 2026,
              page: 1,
              licenceId: "CC-BY-4.0",
            },
            excerpt: "A research passage",
            score: 1,
          },
        ],
        answerable: true,
        retrievalMode: "lexical",
        warnings: [],
      });
      const service = createService(vi.fn(), vi.fn().mockResolvedValue(success(knowledgeResult)));
      const result = await service.execute(
        USER_ID,
        "search_knowledge",
        { query: "experiment" },
        "call-docs",
      );

      expect(result.toolCall.status).toBe("completed");
      const modelResult = zAssistantKnowledgeSearchResponse.parse(result.modelResult);
      expect(modelResult.hits[0]?.citation.route).toBe(docsUrl ?? "/guide");
      expect(modelResult.hits[1]?.citation).toEqual(knowledgeResult.hits[1]?.citation);
      expect(result.sources.map((source) => source.url)).toEqual([
        "/guide",
        `/platform/assistant/corpus/${SOURCE_ID}`,
      ]);
      expect(knowledgeResult.hits[0]?.citation.route).toBe("/guide");
    },
  );

  it("preserves readable source in a macro proposal without executing or creating it", async () => {
    const service = createService(vi.fn());
    const code =
      'return {"sample": ctx["sample_id"]["answer"], "reading": json["light_intensity"]}';
    const result = await service.execute(
      USER_ID,
      "draft_entity",
      {
        kind: "macro",
        value: {
          name: "Label light readings",
          language: "python",
          code,
          codeEncoding: "utf8",
          description:
            "Attach the sample label to a supplied light-intensity reading. The expected device output field must be checked before use.",
        },
      },
      "macro-call",
    );
    expect(result.toolCall.status).toBe("completed");
    expect(result.draft?.payload).toMatchObject({
      kind: "macro",
      value: { code, codeEncoding: "utf8", visibility: "private" },
    });
    expect(result.modelResult).toMatchObject({
      status: "pending_confirmation",
      persistedFields: ["name", "description", "language", "code", "visibility"],
    });
  });

  it("rejects a shell experiment instead of acknowledging an unwritten research plan", async () => {
    const result = await createService(vi.fn()).execute(
      USER_ID,
      "draft_entity",
      {
        kind: "experiment",
        value: { name: "Empty plan" },
      },
      "empty-call",
    );
    expect(result.toolCall.status).toBe("failed");
    expect(result.draft).toBeUndefined();
  });

  it("refuses unreadable protocol and macro references before proposing a workbook", async () => {
    const can = vi
      .fn()
      .mockResolvedValueOnce({ allow: true })
      .mockResolvedValueOnce({ allow: false });
    const result = await createService(can).execute(
      USER_ID,
      "draft_entity",
      {
        kind: "workbook",
        value: {
          name: "Sun and shade",
          description:
            "Record sample identity and compare paired ambient light readings with a researcher-reviewed device recipe.",
          cells: [
            { id: "read", type: "protocol", payload: { protocolId: SOURCE_ID, version: 1 } },
            { id: "analyse", type: "macro", payload: { macroId: USER_ID, language: "python" } },
          ],
        },
      },
      "workbook-call",
    );
    expect(can).toHaveBeenNthCalledWith(1, USER_ID, {
      resourceType: "protocol",
      resourceId: SOURCE_ID,
      action: "read",
    });
    expect(can).toHaveBeenNthCalledWith(2, USER_ID, {
      resourceType: "macro",
      resourceId: USER_ID,
      action: "read",
    });
    expect(result.toolCall.status).toBe("failed");
    expect(result.draft).toBeUndefined();
  });

  it("makes generated drafts private by default", async () => {
    const service = createService(vi.fn());

    const result = await service.execute(
      USER_ID,
      "draft_entity",
      {
        kind: "experiment",
        value: {
          name: "Canopy trial",
          description:
            "Compare ambient light readings at paired sun and shade positions, recording sample and treatment labels.",
        },
      },
      "call-1",
    );

    expect(result.toolCall.status).toBe("completed");
    expect(result.draft?.payload).toMatchObject({
      kind: "experiment",
      value: { name: "Canopy trial", visibility: "private" },
    });
  });

  it("refuses a draft derived from an unreadable source", async () => {
    const can = vi.fn().mockResolvedValue({ allow: false });
    const service = createService(can);

    const result = await service.execute(
      USER_ID,
      "draft_entity",
      {
        kind: "experiment",
        value: {
          name: "Copied trial",
          description:
            "Compare ambient light readings at paired sun and shade positions, recording sample and treatment labels.",
        },
        source: { type: "experiment", id: SOURCE_ID, title: "Private source" },
      },
      "call-2",
    );

    expect(can).toHaveBeenCalledWith(USER_ID, {
      resourceType: "experiment",
      resourceId: SOURCE_ID,
      action: "read",
    });
    expect(result.toolCall.status).toBe("failed");
    expect(result.draft).toBeUndefined();
  });
});

function createService(
  can: ReturnType<typeof vi.fn>,
  knowledgeSearch = vi.fn(),
): AssistantToolService {
  return new AssistantToolService(
    { can } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    fromPartial({ search: knowledgeSearch }),
  );
}

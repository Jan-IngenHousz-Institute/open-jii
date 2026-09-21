import { fromPartial } from "@total-typescript/shoehorn";

import type { AssistantKnowledgeHit } from "@repo/api/domains/assistant-knowledge/assistant-knowledge.schema";

import { PublicAssistantToolsController } from "./public-assistant-tools.controller";

function hit(sourceType: "docs" | "corpus", sourceUrl: string | null): AssistantKnowledgeHit {
  return {
    citation: {
      sourceType,
      sourceId: "source-1",
      title: "Source",
      year: null,
      page: null,
      route: sourceType === "docs" ? "/guide" : "/platform/assistant/corpus/source-1",
      sourceUrl,
      licenceId: null,
    },
    excerpt: "Example passage",
    score: 1,
  };
}

describe("public assistant citation links", () => {
  it.each([
    { sourceUrl: "javascript:alert(1)", expectedUrl: null },
    { sourceUrl: "data:text/html,<script>alert(1)</script>", expectedUrl: null },
    { sourceUrl: "ftp://paper.example/study.pdf", expectedUrl: null },
    {
      sourceUrl: "https://paper.example/study.pdf",
      expectedUrl: "https://paper.example/study.pdf",
    },
    { sourceUrl: "http://paper.example/study.pdf", expectedUrl: "http://paper.example/study.pdf" },
    { sourceUrl: null, expectedUrl: null },
  ])(
    "sanitizes persisted corpus URL $sourceUrl in both public response formats",
    async ({ sourceUrl, expectedUrl }) => {
      const persistedHit = hit("corpus", sourceUrl);
      const controller = new PublicAssistantToolsController(
        fromPartial({ listExternallyPublicCorpusHits: vi.fn().mockResolvedValue([persistedHit]) }),
        fromPartial({ search: vi.fn().mockResolvedValue([]) }),
      );
      const response = await controller.handle({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "search_public_knowledge", arguments: { query: "example", limit: 5 } },
      });
      const projectedHit = {
        ...persistedHit,
        citation: { ...persistedHit.citation, route: expectedUrl, sourceUrl: expectedUrl },
      };
      expect(response).toMatchObject({
        result: {
          structuredContent: { hits: [projectedHit] },
          content: [
            {
              type: "text",
              text: JSON.stringify({
                hits: [projectedHit],
                retrievalMode: "lexical",
                corpusPolicy:
                  "Corpus results require a separate external-public rights approval. Platform-only approval is insufficient.",
              }),
            },
          ],
        },
      });
      expect(persistedHit.citation.sourceUrl).toBe(sourceUrl);
    },
  );

  it.each(["http://localhost:3010/guide", "https://docs.dev.openjii.org/guide"])(
    "returns usable external links with docs URL %s and no authenticated corpus route",
    async (docsUrl) => {
      const controller = new PublicAssistantToolsController(
        fromPartial({
          listExternallyPublicCorpusHits: vi
            .fn()
            .mockResolvedValue([hit("corpus", "https://paper.example/study"), hit("corpus", null)]),
        }),
        fromPartial({ search: vi.fn().mockResolvedValue([hit("docs", docsUrl)]) }),
      );
      const response = await controller.handle({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "search_public_knowledge", arguments: { query: "example", limit: 5 } },
      });
      expect(response).toMatchObject({
        result: {
          structuredContent: {
            hits: [
              { citation: { route: docsUrl, sourceUrl: docsUrl } },
              { citation: { route: "https://paper.example/study" } },
              { citation: { route: null } },
            ],
          },
        },
      });
    },
  );
});

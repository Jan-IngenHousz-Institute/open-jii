import { Body, Controller, Post } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { z } from "zod";

import { zAssistantKnowledgeSourceUrl } from "@repo/api/domains/assistant-knowledge/assistant-knowledge.schema";

import { AssistantKnowledgeService } from "../assistant-knowledge.service";
import { DocsRetriever } from "../infrastructure/docs-retriever";

const zJsonRpcRequest = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]),
  method: z.string(),
  params: z.unknown().optional(),
});

const zPublicSearchArguments = z.object({
  query: z.string().trim().min(2).max(500),
  limit: z.number().int().min(1).max(10).default(5),
});

@AllowAnonymous()
@Controller()
export class PublicAssistantToolsController {
  constructor(
    private readonly service: AssistantKnowledgeService,
    private readonly docsRetriever: DocsRetriever,
  ) {}

  @Post("/api/v1/public/assistant-tools/mcp")
  async handle(@Body() rawRequest: unknown) {
    const request = zJsonRpcRequest.safeParse(rawRequest);
    if (!request.success) {
      return this.error(null, -32600, "Invalid JSON-RPC request");
    }
    const { id, method, params } = request.data;
    if (method === "initialize") {
      return this.result(id, {
        protocolVersion: "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "openjii-public-knowledge", version: "0.1.0" },
      });
    }
    if (method === "tools/list") {
      return this.result(id, {
        tools: [
          {
            name: "search_public_knowledge",
            description:
              "Search openJII public documentation and corpus works explicitly approved for external public redistribution.",
            inputSchema: {
              type: "object",
              properties: {
                query: { type: "string", minLength: 2, maxLength: 500 },
                limit: { type: "integer", minimum: 1, maximum: 10, default: 5 },
              },
              required: ["query"],
              additionalProperties: false,
            },
          },
        ],
      });
    }
    if (method === "tools/call") {
      const call = z
        .object({ name: z.literal("search_public_knowledge"), arguments: zPublicSearchArguments })
        .safeParse(params);
      if (!call.success) {
        return this.error(id, -32602, "Invalid search_public_knowledge arguments");
      }
      const [docs, corpus] = await Promise.all([
        this.docsRetriever.search(call.data.arguments.query, call.data.arguments.limit),
        this.service.listExternallyPublicCorpusHits(
          call.data.arguments.query,
          call.data.arguments.limit,
        ),
      ]);
      const hits = [...docs, ...corpus]
        .sort((left, right) => right.score - left.score)
        .slice(0, call.data.arguments.limit);
      const structuredContent = {
        hits: hits.map((hit) => {
          const parsedUrl = zAssistantKnowledgeSourceUrl.safeParse(hit.citation.sourceUrl);
          const sourceUrl = parsedUrl.success ? parsedUrl.data : null;
          return {
            ...hit,
            citation: { ...hit.citation, route: sourceUrl, sourceUrl },
          };
        }),
        retrievalMode: "lexical",
        corpusPolicy:
          "Corpus results require a separate external-public rights approval. Platform-only approval is insufficient.",
      };
      return this.result(id, {
        content: [{ type: "text", text: JSON.stringify(structuredContent) }],
        structuredContent,
        isError: false,
      });
    }
    return this.error(id, -32601, "Method not found");
  }

  private result(id: string | number | null, result: unknown) {
    return { jsonrpc: "2.0" as const, id, result };
  }

  private error(id: string | number | null, code: number, message: string) {
    return { jsonrpc: "2.0" as const, id, error: { code, message } };
  }
}

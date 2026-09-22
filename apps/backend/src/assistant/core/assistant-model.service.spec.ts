import { ConfigService } from "@nestjs/config";
import { vi } from "vitest";
import { z } from "zod";

import type { AssistantToolCall } from "@repo/api/domains/assistant/assistant.schema";

import type { DatabricksAuthService } from "../../common/modules/databricks/services/auth/auth.service";
import { SYSTEM_PROMPT, TOOLS } from "./assistant-model.contract";
import { AssistantModelService } from "./assistant-model.service";

describe("AssistantModelService", () => {
  it("supplies Python runtime instructions once in the code schema and points the prompt to them", () => {
    const draftTool = TOOLS.find((tool) => tool.function.name === "draft_entity");
    const draftParameters = z
      .object({
        properties: z.object({
          value: z.object({ anyOf: z.array(z.object({ title: z.string() }).passthrough()) }),
        }),
      })
      .parse(draftTool?.function.parameters);
    const macro = draftParameters.properties.value.anyOf.find((value) => value.title === "macro");
    const schema = z
      .object({
        properties: z.object({ code: z.object({ description: z.string() }) }),
      })
      .parse(macro);

    expect(SYSTEM_PROMPT).toContain(
      "Follow the runtime instructions in the macro code field schema",
    );
    expect(SYSTEM_PROMPT).not.toContain("Python source is a function body");
    const instructions = schema.properties.code.description;
    expect(instructions).toContain("Python source is a function body");
    expect(instructions).toContain("top-level return of a JSON-serializable dict");
    expect(instructions).toContain('output["sample"] = value; do not rebind output');
    expect(instructions).toContain("Defining main(json, ctx) alone does nothing");
    expect(instructions).toContain("read-only mappings, not dict instances");
    expect(instructions).toContain(
      "Never require isinstance(ctx, dict) or isinstance(ctx[key], dict)",
    );
    expect(instructions).toContain("np (numpy), pd (pandas), scipy and json_module");
    expect(instructions).toContain("MathMEAN, GetProtocolByLabel and TransformTrace");
    expect(instructions).toContain("one-second execution limit");
    expect(instructions).toContain("restricted builtins omit bool, type, hasattr and __import__");
    expect(instructions).toContain(
      "isinstance(x, (int, float)) and x is not True and x is not False",
    );
    expect(instructions).toContain('return {"sample": ctx.get("sample_id", {}).get("answer")}');
  });

  it("continues a Python-owned tool turn and uses its cumulative usage", async () => {
    const post = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          status: "tool_requests",
          continuationToken: "encrypted-continuation",
          requests: [
            {
              id: "call-1",
              name: "search_entities",
              arguments: { query: "fluorescence" },
            },
          ],
          usage: { inputTokens: 10, outputTokens: 1 },
          usageComplete: true,
        },
      })
      .mockResolvedValueOnce({
        data: {
          status: "completed",
          content: "The experiment is available.",
          stopReason: "stop",
          usage: { inputTokens: 30, outputTokens: 11 },
          usageComplete: true,
        },
      });
    const service = createService(post);
    const toolCall: AssistantToolCall = {
      id: "call-1",
      name: "search_entities",
      status: "completed",
      summary: "Found one experiment",
      result: { count: 1 },
    };
    const executeTool = vi.fn().mockResolvedValue({
      modelResult: { count: 1 },
      toolCall,
    });

    const result = await service.run(
      [{ role: "user", content: "Find my fluorescence experiment" }],
      executeTool,
    );

    expect(result).toEqual({
      content: "The experiment is available.",
      toolCalls: [toolCall],
      inputTokens: 30,
      outputTokens: 11,
      usageComplete: true,
    });
    expect(executeTool).toHaveBeenCalledWith(
      "search_entities",
      { query: "fluorescence" },
      "call-1",
    );
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0]?.[0]).toBe("http://127.0.0.1:8030/v1/agent/turns");
    expect(post.mock.calls[0]?.[1]).toMatchObject({
      protocolVersion: 1,
      tools: TOOLS,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: "Find my fluorescence experiment" },
      ],
      limits: {
        maxToolRounds: 4,
        maxTotalTokens: 100_000,
        maxOutputTokens: 2_000,
        maxToolCallsPerRound: 8,
      },
    });
    expect(post.mock.calls[1]?.[1]).toEqual({
      protocolVersion: 1,
      continuationToken: "encrypted-continuation",
      results: [
        {
          id: "call-1",
          name: "search_entities",
          status: "completed",
          result: { count: 1 },
        },
      ],
    });
    for (const call of post.mock.calls) {
      const requestConfig = call[2] as { headers: Record<string, string> };
      expect(requestConfig).toMatchObject({
        headers: {
          "Content-Type": "application/json",
          "X-OpenJII-Gateway-Key": "gateway-secret",
        },
        maxBodyLength: 2 * 1024 * 1024,
        maxContentLength: 2 * 1024 * 1024,
      });
      expect(requestConfig.headers).not.toHaveProperty("Authorization");
    }
  });

  it("bounds the initial agent history to 100 messages including the system prompt", async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        status: "completed",
        content: "Done",
        stopReason: "stop",
        usage: { inputTokens: 1, outputTokens: 1 },
        usageComplete: true,
      },
    });
    const service = createService(post);
    const history = Array.from({ length: 120 }, (_, index) => ({
      role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `message-${index}`,
    }));

    await service.run(history, vi.fn());

    const body = post.mock.calls[0]?.[1] as { messages: { content: string }[] };
    expect(body.messages).toHaveLength(100);
    expect(body.messages[1]?.content).toBe("message-21");
    expect(body.messages[99]?.content).toBe("message-119");
  });

  it.each([
    ["PROVIDER_UNAVAILABLE", false],
    ["TOKEN_BUDGET_EXCEEDED", true],
  ])("preserves %s and its usage completeness", async (code, usageComplete) => {
    const post = vi.fn().mockRejectedValue({
      response: {
        data: {
          detail: {
            code,
            message: "Provider transport failed",
            usage: { inputTokens: 23, outputTokens: 7 },
            usageComplete,
          },
        },
      },
    });

    await expect(
      createService(post).run([{ role: "user", content: "Hello" }], vi.fn()),
    ).rejects.toMatchObject({
      code,
      details: {
        usage: { inputTokens: 23, outputTokens: 7 },
        usageComplete,
      },
    });
  });

  it("rejects an untrusted remote agent before sending credentials", async () => {
    const post = vi.fn();
    const service = createService(post, { agentUrl: "https://attacker.example" });

    await expect(service.run([{ role: "user", content: "Hello" }], vi.fn())).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
    });
    expect(post).not.toHaveBeenCalled();
  });

  it("sends OAuth only to the configured HTTPS agent hostname", async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        status: "completed",
        content: "Done",
        stopReason: "stop",
        usage: { inputTokens: 1, outputTokens: 1 },
        usageComplete: true,
      },
    });
    const getAccessToken = vi.fn().mockResolvedValue({
      isFailure: () => false,
      value: "workspace-token",
    });
    const service = createService(
      post,
      {
        agentUrl: "https://assistant.example.databricksapps.com",
        trustedAgentHost: "assistant.example.databricksapps.com",
      },
      getAccessToken,
    );

    await service.run([{ role: "user", content: "Hello" }], vi.fn());

    expect(getAccessToken).toHaveBeenCalledOnce();
    expect(post.mock.calls[0]?.[2]).toMatchObject({
      headers: { Authorization: "Bearer workspace-token" },
    });
  });
});

function createService(
  post: ReturnType<typeof vi.fn>,
  overrides: Record<string, unknown> = {},
  getAccessToken: ReturnType<typeof vi.fn> = vi.fn(),
): AssistantModelService {
  const config = new ConfigService({
    assistant: {
      agentUrl: "http://127.0.0.1:8030",
      gatewayToken: "gateway-secret",
      modelEndpoint: "databricks-glm-5-3-flash",
      maxToolRounds: 4,
      maxOutputTokens: 2_000,
      ...overrides,
    },
  });
  return new AssistantModelService({ axiosRef: { post } } as never, config, {
    getAccessToken,
  } as unknown as DatabricksAuthService);
}

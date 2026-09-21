import { describe, expect, it } from "vitest";

import {
  zAssistantChatInput,
  zAssistantDraftPayload,
  zAssistantSource,
  zAssistantNewDraftPayload,
  assistantDraftValueJsonSchemas,
} from "./assistant.schema";

describe("assistant schemas", () => {
  it("accepts every confirmable draft kind", () => {
    const examples = [
      { kind: "experiment", value: { name: "Canopy trial" } },
      {
        kind: "protocol",
        value: { name: "MultispeQ protocol", family: "multispeq", code: [] },
      },
      { kind: "workbook", value: { name: "Analysis workbook" } },
      {
        kind: "macro",
        value: { name: "Normalize readings", language: "python", code: "print('ok')" },
      },
      {
        kind: "visualization",
        value: {
          experimentId: "00000000-0000-4000-8000-000000000001",
          name: "Treatment response",
          chartFamily: "basic",
          chartType: "line",
          dataConfig: {
            tableName: "measurements",
            dataSources: [{ tableName: "measurements", columnName: "value", role: "y" }],
          },
        },
      },
    ];

    for (const example of examples) {
      expect(zAssistantDraftPayload.safeParse(example).success).toBe(true);
    }
  });

  it.each(["python", "javascript", "r"])(
    "limits new macro drafts to Python while preserving saved %s drafts",
    (language) => {
      const payload = {
        kind: "macro",
        value: {
          name: "Summary",
          language,
          code: "return {}",
          codeEncoding: "utf8",
          description:
            "Summarize the supplied sample metadata without executing any device commands.",
        },
      };
      expect(zAssistantNewDraftPayload.safeParse(payload).success).toBe(language === "python");
      expect(zAssistantDraftPayload.safeParse(payload).success).toBe(true);
    },
  );

  it("preserves UTF-8 encoding in persisted macro drafts while accepting legacy drafts", () => {
    const value = { name: "Light summary", language: "python", code: 'return {"label": "葉"}' };
    expect(
      zAssistantDraftPayload.parse({ kind: "macro", value: { ...value, codeEncoding: "utf8" } }),
    ).toMatchObject({ value: { codeEncoding: "utf8" } });
    expect(zAssistantDraftPayload.parse({ kind: "macro", value })).toMatchObject({ value });
  });

  it("uses the existing MultispeQ and workbook contracts for substantive new content", () => {
    const description =
      "Compare ambient light readings at sun and shade sampling positions. Review on actual equipment before collecting data.";
    expect(
      zAssistantNewDraftPayload.safeParse({
        kind: "protocol",
        value: {
          name: "Ambient PAR",
          description,
          family: "multispeq",
          code: [{ environmental: [["light_intensity"]] }],
        },
      }).success,
    ).toBe(true);
    expect(
      zAssistantNewDraftPayload.safeParse({
        kind: "workbook",
        value: {
          name: "Sun and shade",
          description,
          cells: [
            {
              id: "instructions",
              type: "markdown",
              content:
                "Select sun or shade, record the sample ID, then measure using a reviewed recipe.",
            },
            {
              id: "treatment",
              type: "question",
              name: "Treatment",
              question: {
                kind: "multi_choice",
                text: "Sampling position",
                options: ["sun", "shade"],
                required: true,
              },
            },
          ],
        },
      }).success,
    ).toBe(true);
  });

  it.each([
    { code: [] },
    { code: [{}] },
    { code: [{ label: "Empty" }] },
    { code: [{ unsupported_command: true }] },
  ])("rejects missing or malformed MultispeQ content %j", ({ code }) => {
    expect(
      zAssistantNewDraftPayload.safeParse({
        kind: "protocol",
        value: {
          name: "PAR",
          description: "Compare sun and shade using a reviewed ambient-light protocol.",
          family: "multispeq",
          code,
        },
      }).success,
    ).toBe(false);
  });

  it("rejects empty workbooks, duplicate question names and invented output cells", () => {
    const description =
      "Collect metadata and ambient-light readings at sun and shade sampling positions.";
    const question = {
      id: "one",
      type: "question",
      name: "Sample ID",
      question: { kind: "open_ended", text: "Sample ID" },
    };
    for (const cells of [
      [],
      [question, { ...question, id: "two", name: "sample_id" }],
      [{ id: "fake", type: "output", producedBy: "nonexistent", data: { value: 1 } }],
    ]) {
      expect(
        zAssistantNewDraftPayload.safeParse({
          kind: "workbook",
          value: { name: "Field work", description, cells },
        }).success,
      ).toBe(false);
    }
  });

  it("bounds new authoring and rejects unsupported experiment metadata fields", () => {
    const value = {
      name: "Trial",
      description: "Compare ambient-light readings at paired sun and shade positions.",
    };
    expect(
      zAssistantNewDraftPayload.safeParse({
        kind: "experiment",
        value: { ...value, metadata: ["sample_id"] },
      }).success,
    ).toBe(false);
    expect(
      zAssistantNewDraftPayload.safeParse({
        kind: "experiment",
        value: { ...value, description: "x".repeat(12_001) },
      }).success,
    ).toBe(false);
    expect(
      zAssistantNewDraftPayload.safeParse({
        kind: "macro",
        value: { ...value, language: "python", codeEncoding: "utf8", code: "x".repeat(32_001) },
      }).success,
    ).toBe(false);
    expect(
      zAssistantNewDraftPayload.safeParse({
        kind: "workbook",
        value: {
          ...value,
          cells: Array.from({ length: 31 }, (_, index) => ({
            id: `${index}`,
            type: "markdown",
            content: "Instruction",
          })),
        },
      }).success,
    ).toBe(false);
  });

  it("exposes field schemas to the model from the authoring contracts", () => {
    const schemas = assistantDraftValueJsonSchemas();
    for (const [kind, required] of [
      ["protocol", ["code", "family", "description"]],
      ["workbook", ["cells", "description"]],
      ["macro", ["code", "language", "codeEncoding"]],
    ] as const) {
      const schema = schemas.find((entry) => entry.title === kind);
      expect(schema).toHaveProperty("type", "object");
      expect(schema).toHaveProperty("required", expect.arrayContaining([...required]));
    }
  });

  it("rejects malformed page context and overlong prompts", () => {
    expect(
      zAssistantChatInput.safeParse({
        message: "What happened?",
        context: {
          route: "/platform/experiments/test",
          entity: { type: "experiment", id: "test" },
        },
      }).success,
    ).toBe(false);
    expect(zAssistantChatInput.safeParse({ message: "x".repeat(10_001) }).success).toBe(false);
  });

  it("keeps citation excerpts bounded", () => {
    expect(
      zAssistantSource.safeParse({
        id: "docs:test",
        type: "docs",
        title: "Test",
        excerpt: "x".repeat(1_001),
      }).success,
    ).toBe(false);
  });
});

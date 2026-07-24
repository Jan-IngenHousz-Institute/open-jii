import { describe, it, expect } from "vitest";

import { zErrorResponse } from "../../shared/errors";
import { zExperimentData, zExperimentDataColumn } from "./data/experiment-data.schema";
import {
  // Enums / small schemas
  zExperimentStatus,
  zExperimentVisibility,
  zExperimentMemberRole,
  // Experiment core
  zExperiment,
  zExperimentList,
  zExperimentAccess,
  // Data
  // ExperimentFlow
  zExperimentFlowNodeType,
  zExperimentQuestionKind,
  zExperimentQuestionContent,
  zExperimentInstructionContent,
  zExperimentMeasurementContent,
  zExperimentAnalysisContent,
  zExperimentFlowNode,
  zExperimentFlowEdge,
  zExperimentFlowGraph,
  // Creation / update & filters
  zCreateExperimentBody,
  zUpdateExperimentBody,
  zExperimentFilterQuery,
  // Path params / responses
  zExperimentIdPathParam,
  zCreateExperimentResponse,
} from "./experiment.schema";

const uuidA = "11111111-1111-1111-1111-111111111111";
const uuidB = "22222222-2222-2222-2222-222222222222";
const uuidC = "33333333-3333-3333-3333-333333333333";
const isoTime = "2024-01-15T10:00:00Z";
const isoTime2 = "2024-01-15T11:00:00Z";

describe("Experiment Schema", () => {
  describe("Enums", () => {
    it("zExperimentStatus accepts valid values", () => {
      const all = ["active", "stale", "archived", "published"] as const;
      for (const v of all) expect(zExperimentStatus.parse(v)).toBe(v);
    });

    it("zExperimentVisibility accepts valid values and rejects invalid", () => {
      expect(zExperimentVisibility.parse("private")).toBe("private");
      expect(zExperimentVisibility.parse("public")).toBe("public");
      expect(() => zExperimentVisibility.parse("friends-only")).toThrow();
    });

    it("zExperimentMemberRole accepts valid values", () => {
      expect(zExperimentMemberRole.parse("admin")).toBe("admin");
      expect(zExperimentMemberRole.parse("member")).toBe("member");
    });
  });

  describe("Experiment Data", () => {
    it("zExperimentDataColumn valid", () => {
      const col = { name: "x", type_name: "text", type_text: "VARCHAR" };
      expect(zExperimentDataColumn.parse(col)).toEqual(col);
    });

    it("zExperimentData valid with nullable row values", () => {
      const data = {
        columns: [
          { name: "a", type_name: "text", type_text: "VARCHAR" },
          { name: "b", type_name: "text", type_text: "VARCHAR" },
        ],
        rows: [
          { a: "1", b: null },
          { a: "2", b: "ok" },
        ],
        totalRows: 2,
        truncated: false,
      };
      expect(zExperimentData.parse(data)).toEqual(data);
    });
  });

  describe("Experiment core models", () => {
    const baseExperiment = {
      id: uuidA,
      name: "Exp 1",
      organizationId: null,
      description: "desc",
      status: "active",
      visibility: "private",
      embargoUntil: isoTime,
      anonymizeContributors: false,
      workbookId: null,
      workbookVersionId: null,
      createdBy: uuidB,
      createdAt: isoTime,
      updatedAt: isoTime2,
    };

    it("zExperiment valid without data", () => {
      expect(zExperiment.parse(baseExperiment)).toEqual(baseExperiment);
    });

    it("zExperiment valid with data", () => {
      const withData = {
        ...baseExperiment,
        data: {
          columns: [{ name: "x", type_name: "text", type_text: "VARCHAR" }],
          rows: [{ x: "42" }],
          totalRows: 1,
          truncated: false,
        },
      };
      expect(zExperiment.parse(withData)).toEqual(withData);
    });

    it("zExperiment rejects bad datetime", () => {
      const bad = { ...baseExperiment, createdAt: "not-date" };
      expect(() => zExperiment.parse(bad)).toThrow();
    });

    it("zExperimentList valid array", () => {
      const list = [{ ...baseExperiment }, { ...baseExperiment, id: uuidC, name: "Exp 2" }];
      expect(zExperimentList.parse(list)).toEqual(list);
    });

    it("zErrorResponse valid", () => {
      expect(zErrorResponse.parse({ message: "Nope" })).toEqual({ message: "Nope" });
    });
  });

  describe("Access", () => {
    it("zExperimentAccess valid", () => {
      const exp = {
        id: uuidA,
        name: "E1",
        organizationId: null,
        description: null,
        status: "active",
        visibility: "public",
        embargoUntil: isoTime,
        anonymizeContributors: false,
        workbookId: null,
        workbookVersionId: null,
        createdBy: uuidB,
        createdAt: isoTime,
        updatedAt: isoTime2,
      };
      const access = {
        experiment: exp,
        hasAccess: true,
        isAdmin: false,
      };
      expect(zExperimentAccess.parse(access)).toEqual(access);
    });
  });

  describe("ExperimentFlow graph & nodes", () => {
    it("zExperimentFlowNodeType and zExperimentQuestionKind enums", () => {
      expect(zExperimentFlowNodeType.parse("question")).toBe("question");
      expect(zExperimentFlowNodeType.parse("analysis")).toBe("analysis");
      expect(zExperimentQuestionKind.parse("open_ended")).toBe("open_ended");
      expect(() => zExperimentFlowNodeType.parse("calc")).toThrow();
    });

    it("Question content (.strict) rejects extra keys", () => {
      const good = { kind: "yes_no", text: "OK?", required: false };
      expect(zExperimentQuestionContent.parse(good)).toEqual(good);

      const bad = { kind: "yes_no", text: "OK?", extra: 1 };
      expect(() => zExperimentQuestionContent.parse(bad)).toThrow();
    });

    it("Multi choice requires options", () => {
      const mc = { kind: "multi_choice", text: "Pick", options: ["a", "b"], required: false };
      expect(zExperimentQuestionContent.parse(mc)).toEqual(mc);

      const bad = { kind: "multi_choice", text: "Pick", options: [] };
      expect(() => zExperimentQuestionContent.parse(bad)).toThrow();
    });

    it("Instruction and Measurement content valid", () => {
      expect(zExperimentInstructionContent.parse({ text: "Do X" })).toEqual({ text: "Do X" });
      const m = { protocolId: uuidA, params: { exposure: 1, comment: "ok" } };
      expect(zExperimentMeasurementContent.parse(m)).toEqual(m);
    });

    it("Analysis content requires valid macroId", () => {
      const valid = { macroId: uuidA, params: { threshold: 10 } };
      expect(zExperimentAnalysisContent.parse(valid)).toEqual(valid);

      const validMinimal = { macroId: uuidB };
      expect(zExperimentAnalysisContent.parse(validMinimal)).toEqual({ macroId: uuidB });

      const invalidMacroId = { macroId: "not-a-uuid", params: {} };
      expect(() => zExperimentAnalysisContent.parse(invalidMacroId)).toThrow();

      const missingMacroId = { params: {} };
      expect(() => zExperimentAnalysisContent.parse(missingMacroId)).toThrow();
    });

    it("zExperimentFlowNode valid (defaults isStart=false)", () => {
      const node = {
        id: "n1",
        type: "question",
        name: "Start Q",
        content: { kind: "open_ended", text: "Hello?", required: false },
      };
      const parsed = zExperimentFlowNode.parse(node);
      expect(parsed).toEqual({ ...node, isStart: false });
    });

    it("zExperimentFlowEdge valid", () => {
      const edge = { id: "e1", source: "n1", target: "n2", label: "Yes" as string | null };
      expect(zExperimentFlowEdge.parse(edge)).toEqual(edge);
    });

    it("rejects a flow node with a wrong-level sibling command/ref key", () => {
      const node = {
        id: "n1",
        type: "question",
        name: "Q",
        content: { kind: "open_ended", text: "?", required: false },
        command: { kind: "ref", ref: { sourceCellId: "s", field: "f" } },
        isStart: true,
      };
      expect(zExperimentFlowNode.safeParse(node).success).toBe(false);
    });

    it("rejects a flow node with an extra position key", () => {
      const node = {
        id: "n1",
        type: "question",
        name: "Q",
        content: { kind: "open_ended", text: "?", required: false },
        position: { x: 1, y: 2, z: 3 },
        isStart: true,
      };
      expect(zExperimentFlowNode.safeParse(node).success).toBe(false);
    });

    it("rejects a flow edge with an extra key", () => {
      const edge = { id: "e1", source: "n1", target: "n2", command: { kind: "ref" } };
      expect(zExperimentFlowEdge.safeParse(edge).success).toBe(false);
    });

    it("zExperimentFlowGraph enforces exactly one start node", () => {
      const goodGraph = {
        nodes: [
          {
            id: "n1",
            type: "question",
            name: "Q",
            content: { kind: "yes_no", text: "ok?", required: false },
            isStart: true,
          },
          {
            id: "n2",
            type: "instruction",
            name: "Read",
            content: { text: "Follow" },
            isStart: false,
          },
        ],
        edges: [{ id: "e1", source: "n1", target: "n2", label: null }],
      };
      expect(zExperimentFlowGraph.parse(goodGraph)).toEqual(goodGraph);

      const zeroStart = {
        ...goodGraph,
        nodes: goodGraph.nodes.map((n) => ({ ...n, isStart: false })),
      };
      expect(() => zExperimentFlowGraph.parse(zeroStart)).toThrow();

      const twoStart = {
        ...goodGraph,
        nodes: goodGraph.nodes.map((n) => ({ ...n, isStart: true })),
      };
      expect(() => zExperimentFlowGraph.parse(twoStart)).toThrow();
    });

    it("zExperimentFlowGraph rejects duplicate question-node labels", () => {
      const graph = {
        nodes: [
          {
            id: "n1",
            type: "question",
            name: "Question Node",
            content: { kind: "yes_no", text: "ok?", required: false },
            isStart: true,
          },
          {
            id: "n2",
            type: "question",
            name: "Question Node",
            content: { kind: "yes_no", text: "again?", required: false },
            isStart: false,
          },
        ],
        edges: [{ id: "e1", source: "n1", target: "n2", label: null }],
      };
      const result = zExperimentFlowGraph.safeParse(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.join(".") === "nodes.1.name");
        expect(issue?.message).toContain("Question Node");
        expect(issue?.message).toContain("unique");
      }
    });

    it("zExperimentFlowGraph allows duplicate labels across node types", () => {
      // Only question-node labels become column keys downstream; other types
      // can share labels with each other or with a question without conflict.
      const graph = {
        nodes: [
          {
            id: "n1",
            type: "question",
            name: "Plot",
            content: { kind: "open_ended", text: "Which plot?", required: false },
            isStart: true,
          },
          {
            id: "n2",
            type: "instruction",
            name: "Plot",
            content: { text: "Walk to the plot." },
            isStart: false,
          },
        ],
        edges: [{ id: "e1", source: "n1", target: "n2", label: null }],
      };
      expect(zExperimentFlowGraph.parse(graph)).toEqual(graph);
    });

    it("zExperimentFlowGraph rejects question labels that collide after canonicalization", () => {
      // "Question Node" and "QUESTION-node!" both reduce to `question_node`,
      // i.e. the same pipeline column key.
      const graph = {
        nodes: [
          {
            id: "n1",
            type: "question",
            name: "Question Node",
            content: { kind: "yes_no", text: "a?", required: false },
            isStart: true,
          },
          {
            id: "n2",
            type: "question",
            name: "QUESTION-node!",
            content: { kind: "yes_no", text: "b?", required: false },
            isStart: false,
          },
        ],
        edges: [{ id: "e1", source: "n1", target: "n2", label: null }],
      };
      const result = zExperimentFlowGraph.safeParse(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.join(".") === "nodes.1.name");
        expect(issue?.message).toContain("QUESTION-node!");
      }
    });

    it("zExperimentFlowGraph rejects question labels that resolve to a reserved column", () => {
      // "Device ID" sanitizes to `device_id`, which is a top-level column on
      // experiment_raw_data. Letting it through would shadow the system column
      // when questions_data is flattened to top-level on read or export.
      const graph = {
        nodes: [
          {
            id: "n1",
            type: "question",
            name: "Device ID",
            content: { kind: "open_ended", text: "?", required: false },
            isStart: true,
          },
        ],
        edges: [],
      };
      const result = zExperimentFlowGraph.safeParse(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.join(".") === "nodes.0.name");
        expect(issue?.message).toContain("device_id");
        expect(issue?.message.toLowerCase()).toContain("reserved");
      }
    });

    const uuidA = "11111111-1111-1111-1111-111111111111";
    const uuidB = "22222222-2222-2222-2222-222222222222";

    it("accepts every canonical node type/content pairing", () => {
      const graph = {
        nodes: [
          {
            id: "proto",
            type: "measurement",
            name: "P",
            content: { protocolId: uuidA },
            isStart: true,
          },
          {
            id: "cmd",
            type: "measurement",
            name: "C",
            content: { command: { format: "string", content: "battery" } },
          },
          {
            id: "ref",
            type: "measurement",
            name: "R",
            content: { command: { kind: "ref", ref: { sourceCellId: "mac", field: "toDevice" } } },
          },
          { id: "mac", type: "analysis", name: "M", content: { macroId: uuidB } },
          { id: "q", type: "question", name: "Q", content: { kind: "open_ended", text: "?" } },
          { id: "i", type: "instruction", name: "I", content: { text: "do" } },
          {
            id: "b",
            type: "branch",
            name: "B",
            content: { paths: [{ id: "p1", label: "x", color: "#000" }] },
          },
        ],
        edges: [],
      };
      expect(zExperimentFlowGraph.safeParse(graph).success).toBe(true);
    });

    it("rejects a node whose content does not match its type", () => {
      const graph = {
        nodes: [
          // measurement type but question content
          {
            id: "n1",
            type: "measurement",
            name: "Bad",
            content: { kind: "yes_no", text: "ok?", required: false },
            isStart: true,
          },
        ],
        edges: [],
      };
      const result = zExperimentFlowGraph.safeParse(graph);
      expect(result.success).toBe(false);
    });

    it("rejects an analysis node carrying a measurement protocol", () => {
      const graph = {
        nodes: [
          {
            id: "n1",
            type: "analysis",
            name: "Bad",
            content: { protocolId: uuidA },
            isStart: true,
          },
        ],
        edges: [],
      };
      expect(zExperimentFlowGraph.safeParse(graph).success).toBe(false);
    });

    it.each(["instruction", "analysis", "branch"] as const)(
      "rejects a hidden foreign `command` key on a %s node (strict carrier)",
      (type) => {
        const base = {
          instruction: { text: "do" },
          analysis: { macroId: uuidB },
          branch: { paths: [{ id: "p1", label: "x", color: "#000" }] },
        }[type];
        const graph = {
          nodes: [
            {
              id: "n1",
              type,
              name: "Sneaky",
              content: {
                ...base,
                command: { kind: "ref", ref: { sourceCellId: "s", field: "f" } },
              },
              isStart: true,
            },
          ],
          edges: [],
        };
        expect(zExperimentFlowGraph.safeParse(graph).success).toBe(false);
      },
    );

    it("rejects duplicate node ids", () => {
      const node = (isStart: boolean) => ({
        id: "dup",
        type: "instruction" as const,
        name: "I",
        content: { text: "x" },
        isStart,
      });
      const graph = { nodes: [node(true), node(false)], edges: [] };
      const result = zExperimentFlowGraph.safeParse(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes("Duplicate node id"))).toBe(true);
      }
    });

    it("rejects duplicate edge ids", () => {
      const graph = {
        nodes: [
          { id: "n1", type: "instruction", name: "A", content: { text: "a" }, isStart: true },
          { id: "n2", type: "instruction", name: "B", content: { text: "b" } },
        ],
        edges: [
          { id: "e1", source: "n1", target: "n2" },
          { id: "e1", source: "n2", target: "n1" },
        ],
      };
      const result = zExperimentFlowGraph.safeParse(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes("Duplicate edge id"))).toBe(true);
      }
    });

    it.each(["command", "ref", "payload", "unknown"])(
      "rejects a graph-root %s key instead of stripping it",
      (key) => {
        const graph = {
          nodes: [
            {
              id: "n1",
              type: "instruction",
              name: "Start",
              content: { text: "Go" },
              isStart: true,
            },
          ],
          edges: [],
          [key]: { sentinel: true },
        };

        expect(zExperimentFlowGraph.safeParse(graph).success).toBe(false);
      },
    );
  });

  describe("Create/Update bodies & filters", () => {
    it("zCreateExperimentBody valid minimal", () => {
      const body = { name: "My Exp" };
      expect(zCreateExperimentBody.parse(body)).toEqual(body);
    });

    it("zCreateExperimentBody full with members", () => {
      const body = {
        name: "Big Exp",
        description: "optional",
        status: "active",
        visibility: "public",
        members: [{ userId: uuidA, role: "admin" }, { userId: uuidB }],
      };
      const parsed = zCreateExperimentBody.parse(body);
      expect(parsed).toEqual(body);
    });

    it("zCreateExperimentBody rejects empty name", () => {
      expect(() => zCreateExperimentBody.parse({ name: " " })).toThrow();
    });

    it("zUpdateExperimentBody valid partials", () => {
      const body = { description: "new" };
      expect(zUpdateExperimentBody.parse(body)).toEqual(body);
    });

    it("zExperimentFilterQuery valid and optional", () => {
      // Test empty object (all fields optional)
      expect(zExperimentFilterQuery.parse({})).toEqual({});

      // Test filter field
      expect(zExperimentFilterQuery.parse({ filter: "member" })).toEqual({ filter: "member" });
      expect(() => zExperimentFilterQuery.parse({ filter: "unknown" })).toThrow();

      // Test status field
      expect(zExperimentFilterQuery.parse({ status: "active" })).toEqual({ status: "active" });
      expect(zExperimentFilterQuery.parse({ status: "archived" })).toEqual({ status: "archived" });
      expect(() => zExperimentFilterQuery.parse({ status: "invalid_status" })).toThrow();

      // Test search field
      expect(zExperimentFilterQuery.parse({ search: "test experiment" })).toEqual({
        search: "test experiment",
      });
      expect(zExperimentFilterQuery.parse({ search: "" })).toEqual({ search: "" });
      expect(zExperimentFilterQuery.parse({ search: "special chars !@#$%" })).toEqual({
        search: "special chars !@#$%",
      });

      // Test combinations
      expect(
        zExperimentFilterQuery.parse({
          filter: "member",
          status: "active",
          search: "my experiment",
        }),
      ).toEqual({
        filter: "member",
        status: "active",
        search: "my experiment",
      });
    });
  });

  describe("Path params / responses", () => {
    it("zExperimentIdPathParam valid and rejects bad uuid", () => {
      const ok = { id: uuidA };
      expect(zExperimentIdPathParam.parse(ok)).toEqual(ok);
      expect(() => zExperimentIdPathParam.parse({ id: "nope" })).toThrow();
    });

    it("zCreateExperimentResponse valid", () => {
      expect(zCreateExperimentResponse.parse({ id: uuidA })).toEqual({ id: uuidA });
    });
  });
});

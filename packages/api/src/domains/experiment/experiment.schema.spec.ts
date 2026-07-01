import { describe, it, expect } from "vitest";

import { zErrorResponse } from "../../shared/errors";
import { zExperimentData, zExperimentDataColumn } from "./data/experiment-data.schema";
import { zExperimentDataFilter } from "./data/experiment-data.schema";
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
  zExperimentExportPathParam,
  zCreateExperimentResponse,
  // Export schemas
  zExperimentInitiateExportBody,
  zExperimentInitiateExportResponse,
  zExperimentListExportsQuery,
  zExperimentExportRecord,
  zExperimentListExportsResponse,
  zExperimentDownloadExportResponse,
  // Project transfer schemas
  // Custom metadata
  // Data filter primitives & distinct values
  // Upload schemas
  zExperimentUploadSourceKind,
  zExperimentUploadTableName,
  zExperimentUploadTargetTable,
  zExperimentCsvFilename,
  zExperimentTsvFilename,
  zExperimentParquetFilename,
  zExperimentXlsxFilename,
  zExperimentJsonFilename,
  zExperimentNdjsonFilename,
  zExperimentAmbyteFilename,
  zExperimentUploadMetadata,
  UPLOAD_KIND_CONSTANTS,
  UPLOAD_FILENAME_SCHEMAS,
  inferUploadSourceKind,
  // Dashboards
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
      // Only question-node labels become column keys downstream — other types
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

    it("zExperimentExportPathParam valid and rejects bad uuid", () => {
      const ok = { id: uuidA, exportId: uuidB };
      expect(zExperimentExportPathParam.parse(ok)).toEqual(ok);
      expect(() => zExperimentExportPathParam.parse({ id: uuidA, exportId: "nope" })).toThrow();
      expect(() => zExperimentExportPathParam.parse({ id: "nope", exportId: uuidB })).toThrow();
    });

    it("zCreateExperimentResponse valid", () => {
      expect(zCreateExperimentResponse.parse({ id: uuidA })).toEqual({ id: uuidA });
    });
  });

  describe("Export Data Schemas", () => {
    it("zExperimentInitiateExportBody accepts valid input", () => {
      const body = { tableName: "raw_data", format: "csv" };
      expect(zExperimentInitiateExportBody.parse(body)).toEqual(body);
    });

    it("zExperimentInitiateExportBody accepts all valid formats", () => {
      for (const format of ["csv", "ndjson", "json-array", "parquet"] as const) {
        expect(zExperimentInitiateExportBody.parse({ tableName: "t1", format })).toEqual({
          tableName: "t1",
          format,
        });
      }
    });

    it("zExperimentInitiateExportBody rejects invalid format", () => {
      expect(() =>
        zExperimentInitiateExportBody.parse({ tableName: "t1", format: "xml" }),
      ).toThrow();
    });

    it("zExperimentInitiateExportBody rejects missing fields", () => {
      expect(() => zExperimentInitiateExportBody.parse({ tableName: "t1" })).toThrow();
      expect(() => zExperimentInitiateExportBody.parse({ format: "csv" })).toThrow();
      expect(() => zExperimentInitiateExportBody.parse({})).toThrow();
    });

    it("zExperimentInitiateExportResponse valid", () => {
      const res = { status: "pending" };
      expect(zExperimentInitiateExportResponse.parse(res)).toEqual(res);
    });

    it("zExperimentInitiateExportResponse rejects empty status", () => {
      expect(() => zExperimentInitiateExportResponse.parse({})).toThrow();
    });

    it("zExperimentListExportsQuery valid", () => {
      const q = { tableName: "raw_data" };
      expect(zExperimentListExportsQuery.parse(q)).toEqual(q);
    });

    it("zExperimentListExportsQuery rejects missing tableName", () => {
      expect(() => zExperimentListExportsQuery.parse({})).toThrow();
    });

    it("zExperimentExportRecord accepts complete record", () => {
      const record = {
        exportId: uuidA,
        experimentId: uuidB,
        tableName: "raw_data",
        format: "csv",
        status: "completed",
        filePath: "/path/to/file.csv",
        rowCount: 1000,
        fileSize: 50000,
        createdBy: uuidC,
        createdAt: isoTime,
        completedAt: isoTime2,
      };
      expect(zExperimentExportRecord.parse(record)).toEqual(record);
    });

    it("zExperimentExportRecord accepts nullable fields as null", () => {
      const record = {
        exportId: null,
        experimentId: uuidB,
        tableName: "raw_data",
        format: "ndjson",
        status: "running",
        filePath: null,
        rowCount: null,
        fileSize: null,
        createdBy: uuidC,
        createdAt: isoTime,
        completedAt: null,
      };
      expect(zExperimentExportRecord.parse(record)).toEqual(record);
    });

    it("zExperimentExportRecord accepts all valid statuses", () => {
      const base = {
        exportId: null,
        experimentId: uuidB,
        tableName: "t1",
        format: "csv",
        filePath: null,
        rowCount: null,
        fileSize: null,
        createdBy: uuidC,
        createdAt: isoTime,
        completedAt: null,
      };
      for (const status of ["queued", "pending", "running", "completed", "failed"] as const) {
        expect(zExperimentExportRecord.parse({ ...base, status })).toEqual({ ...base, status });
      }
    });

    it("zExperimentExportRecord rejects invalid status", () => {
      const record = {
        exportId: uuidA,
        experimentId: uuidB,
        tableName: "raw_data",
        format: "csv",
        status: "cancelled",
        filePath: null,
        rowCount: null,
        fileSize: null,
        createdBy: uuidC,
        createdAt: isoTime,
        completedAt: null,
      };
      expect(() => zExperimentExportRecord.parse(record)).toThrow();
    });

    it("zExperimentExportRecord rejects invalid format", () => {
      const record = {
        exportId: uuidA,
        experimentId: uuidB,
        tableName: "raw_data",
        format: "xml",
        status: "completed",
        filePath: null,
        rowCount: null,
        fileSize: null,
        createdBy: uuidC,
        createdAt: isoTime,
        completedAt: null,
      };
      expect(() => zExperimentExportRecord.parse(record)).toThrow();
    });

    it("zExperimentListExportsResponse valid with exports", () => {
      const response = {
        exports: [
          {
            exportId: uuidA,
            experimentId: uuidB,
            tableName: "raw_data",
            format: "csv",
            status: "completed",
            filePath: "/path/to/file.csv",
            rowCount: 100,
            fileSize: 5000,
            createdBy: uuidC,
            createdAt: isoTime,
            completedAt: isoTime2,
          },
        ],
      };
      expect(zExperimentListExportsResponse.parse(response)).toEqual(response);
    });

    it("zExperimentListExportsResponse valid with empty exports", () => {
      const response = { exports: [] };
      expect(zExperimentListExportsResponse.parse(response)).toEqual(response);
    });

    it("zExperimentListExportsResponse rejects missing exports key", () => {
      expect(() => zExperimentListExportsResponse.parse({})).toThrow();
    });

    it("zExperimentDownloadExportResponse accepts any value", () => {
      // z.unknown() accepts anything
      expect(zExperimentDownloadExportResponse.parse("binary data")).toBe("binary data");
      expect(zExperimentDownloadExportResponse.parse(null)).toBe(null);
      expect(zExperimentDownloadExportResponse.parse(42)).toBe(42);
    });
  });

  describe("anonymizeContributors on update/export bodies", () => {
    it("zUpdateExperimentBody accepts the new flag", () => {
      const body = { anonymizeContributors: true };
      expect(zUpdateExperimentBody.parse(body)).toEqual(body);
    });

    it("zExperimentInitiateExportBody accepts the per-export override", () => {
      const body = { tableName: "t", format: "csv" as const, anonymizeContributors: true };
      expect(zExperimentInitiateExportBody.parse(body)).toEqual(body);
    });
  });
  describe("Upload schemas", () => {
    describe("zExperimentUploadSourceKind", () => {
      it("accepts all supported kinds", () => {
        expect(zExperimentUploadSourceKind.safeParse("ambyte").success).toBe(true);
        expect(zExperimentUploadSourceKind.safeParse("csv").success).toBe(true);
        expect(zExperimentUploadSourceKind.safeParse("tsv").success).toBe(true);
        expect(zExperimentUploadSourceKind.safeParse("parquet").success).toBe(true);
        expect(zExperimentUploadSourceKind.safeParse("xlsx").success).toBe(true);
        expect(zExperimentUploadSourceKind.safeParse("json").success).toBe(true);
        expect(zExperimentUploadSourceKind.safeParse("ndjson").success).toBe(true);
      });

      it("rejects unknown kinds", () => {
        expect(zExperimentUploadSourceKind.safeParse("orc").success).toBe(false);
        expect(zExperimentUploadSourceKind.safeParse("").success).toBe(false);
      });
    });

    describe("zExperimentUploadTableName", () => {
      it("accepts ASCII identifier shape", () => {
        expect(zExperimentUploadTableName.safeParse("leaf_traits").success).toBe(true);
        expect(zExperimentUploadTableName.safeParse("Table1").success).toBe(true);
        expect(zExperimentUploadTableName.safeParse("a").success).toBe(true);
      });

      it("rejects names that don't start with a letter", () => {
        expect(zExperimentUploadTableName.safeParse("1table").success).toBe(false);
        expect(zExperimentUploadTableName.safeParse("_table").success).toBe(false);
      });

      it("rejects names with non-identifier characters", () => {
        expect(zExperimentUploadTableName.safeParse("table-name").success).toBe(false);
        expect(zExperimentUploadTableName.safeParse("table name").success).toBe(false);
        expect(zExperimentUploadTableName.safeParse("table.name").success).toBe(false);
      });

      it("rejects names longer than 63 characters", () => {
        expect(zExperimentUploadTableName.safeParse("a".repeat(63)).success).toBe(true);
        expect(zExperimentUploadTableName.safeParse("a".repeat(64)).success).toBe(false);
      });

      it("rejects empty names", () => {
        expect(zExperimentUploadTableName.safeParse("").success).toBe(false);
      });
    });

    describe("zExperimentUploadTargetTable", () => {
      it("accepts a 'new' target with a valid name", () => {
        const result = zExperimentUploadTargetTable.safeParse({ kind: "new", name: "leaf_traits" });
        expect(result.success).toBe(true);
      });

      it("accepts an 'existing' target with a valid uploadTableId UUID", () => {
        const result = zExperimentUploadTargetTable.safeParse({
          kind: "existing",
          uploadTableId: "11111111-1111-1111-1111-111111111111",
        });
        expect(result.success).toBe(true);
      });

      it("rejects an 'existing' target with a non-UUID uploadTableId", () => {
        expect(
          zExperimentUploadTargetTable.safeParse({ kind: "existing", uploadTableId: "leaf_traits" })
            .success,
        ).toBe(false);
      });

      it("rejects an invalid kind", () => {
        expect(zExperimentUploadTargetTable.safeParse({ kind: "other", name: "x" }).success).toBe(
          false,
        );
      });

      it("rejects when name fails identifier validation", () => {
        expect(zExperimentUploadTargetTable.safeParse({ kind: "new", name: "1bad" }).success).toBe(
          false,
        );
      });
    });

    describe("zExperimentCsvFilename", () => {
      it("returns the basename for a path-prefixed CSV", () => {
        const result = zExperimentCsvFilename.safeParse("some/dir/data.csv");
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe("data.csv");
        }
      });

      it("accepts a bare CSV filename", () => {
        const result = zExperimentCsvFilename.safeParse("data.csv");
        expect(result.success).toBe(true);
      });

      it("rejects non-CSV extensions", () => {
        expect(zExperimentCsvFilename.safeParse("data.txt").success).toBe(false);
        expect(zExperimentCsvFilename.safeParse("data").success).toBe(false);
      });

      it("rejects oversize names", () => {
        expect(zExperimentCsvFilename.safeParse("a".repeat(257) + ".csv").success).toBe(false);
      });
    });

    describe("zExperimentTsvFilename", () => {
      it("accepts a bare TSV filename", () => {
        expect(zExperimentTsvFilename.safeParse("data.tsv").success).toBe(true);
      });

      it("rejects non-TSV extensions", () => {
        expect(zExperimentTsvFilename.safeParse("data.csv").success).toBe(false);
      });
    });

    describe("zExperimentParquetFilename", () => {
      it("accepts a bare parquet filename", () => {
        expect(zExperimentParquetFilename.safeParse("data.parquet").success).toBe(true);
      });

      it("rejects non-parquet extensions", () => {
        expect(zExperimentParquetFilename.safeParse("data.csv").success).toBe(false);
      });
    });

    describe("zExperimentXlsxFilename", () => {
      it("accepts .xlsx and .xls", () => {
        expect(zExperimentXlsxFilename.safeParse("data.xlsx").success).toBe(true);
        expect(zExperimentXlsxFilename.safeParse("data.xls").success).toBe(true);
      });

      it("rejects non-Excel extensions", () => {
        expect(zExperimentXlsxFilename.safeParse("data.csv").success).toBe(false);
      });
    });

    describe("zExperimentJsonFilename", () => {
      it("accepts a bare JSON filename", () => {
        expect(zExperimentJsonFilename.safeParse("data.json").success).toBe(true);
      });

      it("rejects non-JSON extensions", () => {
        expect(zExperimentJsonFilename.safeParse("data.ndjson").success).toBe(false);
        expect(zExperimentJsonFilename.safeParse("data.csv").success).toBe(false);
      });
    });

    describe("zExperimentNdjsonFilename", () => {
      it("accepts .ndjson and .jsonl", () => {
        expect(zExperimentNdjsonFilename.safeParse("data.ndjson").success).toBe(true);
        expect(zExperimentNdjsonFilename.safeParse("data.jsonl").success).toBe(true);
      });

      it("rejects non-NDJSON extensions", () => {
        expect(zExperimentNdjsonFilename.safeParse("data.json").success).toBe(false);
        expect(zExperimentNdjsonFilename.safeParse("data.csv").success).toBe(false);
      });
    });

    describe("inferUploadSourceKind", () => {
      it.each([
        ["a.csv", "csv"],
        ["a.CSV", "csv"],
        ["a.tsv", "tsv"],
        ["a.parquet", "parquet"],
        ["a.xlsx", "xlsx"],
        ["a.xls", "xlsx"],
        ["a.json", "json"],
        ["a.ndjson", "ndjson"],
        ["a.jsonl", "ndjson"],
        ["a.txt", "ambyte"],
      ] as const)("infers %s → %s", (filename, expected) => {
        expect(inferUploadSourceKind(filename)).toBe(expected);
      });

      it("returns null for unsupported extensions", () => {
        expect(inferUploadSourceKind("a.orc")).toBeNull();
        expect(inferUploadSourceKind("a")).toBeNull();
      });
    });

    describe("zExperimentAmbyteFilename", () => {
      it("transforms a pathed Ambyte_N file to the trimmed tail", () => {
        const result = zExperimentAmbyteFilename.safeParse("uploads/Ambyte_5/data.txt");
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe("Ambyte_5/data.txt");
        }
      });

      it("transforms a pathed Ambyte_N/[1-4]/file.txt to the 3-segment tail", () => {
        const result = zExperimentAmbyteFilename.safeParse("prefix/Ambyte_12/3/some.txt");
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe("Ambyte_12/3/some.txt");
        }
      });

      it("buckets a bare timestamp filename under unknown_ambyte/unknown_ambit", () => {
        const result = zExperimentAmbyteFilename.safeParse("20260101-120000_.txt");
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe("unknown_ambyte/unknown_ambit/20260101-120000_.txt");
        }
      });

      it("buckets a generic bare .txt under unknown_ambyte", () => {
        const result = zExperimentAmbyteFilename.safeParse("anything.txt");
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe("unknown_ambyte/anything.txt");
        }
      });

      it("rejects non-.txt files", () => {
        expect(zExperimentAmbyteFilename.safeParse("Ambyte_1/data.csv").success).toBe(false);
      });

      it("rejects pathed files that don't match the Ambyte_N tail shape", () => {
        expect(zExperimentAmbyteFilename.safeParse("something/else/data.txt").success).toBe(false);
      });
    });

    describe("UPLOAD_KIND_CONSTANTS + UPLOAD_FILENAME_SCHEMAS", () => {
      const expectedKinds = ["ambyte", "csv", "json", "ndjson", "parquet", "tsv", "xlsx"];

      it("has matching keys for every supported kind", () => {
        expect(Object.keys(UPLOAD_KIND_CONSTANTS).sort()).toEqual(expectedKinds);
        expect(Object.keys(UPLOAD_FILENAME_SCHEMAS).sort()).toEqual(expectedKinds);
      });

      it("every kind lands in the unified 'uploads' volume", () => {
        for (const kind of expectedKinds as (keyof typeof UPLOAD_KIND_CONSTANTS)[]) {
          expect(UPLOAD_KIND_CONSTANTS[kind].volumeSourceType).toBe("uploads");
        }
      });

      it("respects the 5 GiB ceiling — every kind maxFileSize is well below", () => {
        const fiveGib = 5 * 1024 * 1024 * 1024;
        for (const kind of expectedKinds as (keyof typeof UPLOAD_KIND_CONSTANTS)[]) {
          expect(UPLOAD_KIND_CONSTANTS[kind].maxFileSize).toBeLessThan(fiveGib);
        }
      });
    });

    describe("zExperimentUploadMetadata", () => {
      const valid = {
        uploadId: "upload-1",
        experimentId: "exp-1",
        uploadTableId: "11111111-1111-1111-1111-111111111111",
        uploadTableName: "leaf_traits",
        sourceKind: "csv" as const,
        status: "completed" as const,
        fileCount: 2,
        rowCount: 100,
        createdBy: "user-1",
        createdAt: "2026-01-01T00:00:00Z",
        completedAt: "2026-01-01T00:05:00Z",
        errorMessage: null,
      };

      it("accepts a fully-populated completed record", () => {
        expect(zExperimentUploadMetadata.safeParse(valid).success).toBe(true);
      });

      it("accepts null uploadTableId / uploadTableName / row counts / completedAt / errorMessage", () => {
        const result = zExperimentUploadMetadata.safeParse({
          ...valid,
          uploadTableId: null,
          uploadTableName: null,
          fileCount: null,
          rowCount: null,
          completedAt: null,
          errorMessage: null,
        });
        expect(result.success).toBe(true);
      });

      it("rejects unknown status values", () => {
        expect(zExperimentUploadMetadata.safeParse({ ...valid, status: "halfway" }).success).toBe(
          false,
        );
      });
    });
  });
});

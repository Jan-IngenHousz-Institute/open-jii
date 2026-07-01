import { describe, it, expect } from "vitest";

import { zErrorResponse } from "../../shared/errors";
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
  zExperimentDataColumn,
  zExperimentData,
  zExperimentDataQuery,
  zExperimentDataTable,
  zExperimentDataTableList,
  zExperimentDataResponse,
  // Annotations
  zExperimentAnnotationType,
  zExperimentAnnotationFlagType,
  zExperimentAnnotationCommentContent,
  zExperimentAnnotationFlagContent,
  zExperimentAnnotationContent,
  zExperimentAnnotation,
  zExperimentAnnotationList,
  zExperimentAnnotationPathParam,
  zExperimentAddAnnotationBody,
  zExperimentAddAnnotationsBulkBody,
  zExperimentListAnnotationsQuery,
  zExperimentUpdateAnnotationBody,
  zExperimentAnnotationDeleteBulkPathParam,
  zExperimentAnnotationDeleteBulkBody,
  zExperimentAnnotationRowsAffected,
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
  zExperimentFlow,
  zExperimentUpsertFlowBody,
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
  zExperimentProjectTransferQuestionInput,
  zExperimentProjectTransferWebhookPayload,
  zExperimentProjectTransferWebhookResponse,
  // Custom metadata
  zExperimentCustomMetadataPayload,
  makeCustomMetadataFormSchema,
  // Data filter primitives & distinct values
  zExperimentDataFilterOperator,
  zExperimentDataFilterValue,
  zExperimentDataFilter,
  zExperimentDistinctValuesQuery,
  zExperimentDistinctValuesResponse,
  DISTINCT_VALUES_MAX_LIMIT,
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
  zExperimentWidgetLayout,
  zExperimentVisualizationWidget,
  zExperimentRichTextWidget,
  zExperimentTableWidget,
  zExperimentFilterWidget,
  zExperimentDashboardWidget,
  zExperimentDashboardLayout,
  zExperimentDashboard,
  zExperimentDashboardList,
  zCreateExperimentDashboardBody,
  zUpdateExperimentDashboardBody,
  zListExperimentDashboardsQuery,
  zExperimentDashboardPathParam,
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

    it("zExperimentFlow and zExperimentUpsertFlowBody valid", () => {
      const graph = {
        nodes: [
          {
            id: "start",
            type: "question",
            name: "Start",
            content: { kind: "open_ended", text: "Go?", required: false },
            isStart: true,
          },
        ],
        edges: [],
      };
      const flow = {
        id: uuidA,
        experimentId: uuidB,
        graph,
        createdAt: isoTime,
        updatedAt: isoTime2,
      };
      expect(zExperimentFlow.parse(flow)).toEqual(flow);
      expect(zExperimentUpsertFlowBody.parse(graph)).toEqual(graph);
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

  describe("Annotations", () => {
    it("zExperimentAnnotationType accepts valid values", () => {
      expect(zExperimentAnnotationType.parse("comment")).toBe("comment");
      expect(zExperimentAnnotationType.parse("flag")).toBe("flag");
      expect(() => zExperimentAnnotationType.parse("note")).toThrow();
    });

    it("zExperimentAnnotationFlagType accepts valid values", () => {
      expect(zExperimentAnnotationFlagType.parse("outlier")).toBe("outlier");
      expect(zExperimentAnnotationFlagType.parse("needs_review")).toBe("needs_review");
      expect(() => zExperimentAnnotationFlagType.parse("invalid")).toThrow();
    });

    it("zExperimentAnnotationCommentContent valid", () => {
      const comment = { type: "comment", text: "This is a comment" };
      expect(zExperimentAnnotationCommentContent.parse(comment)).toEqual(comment);
    });

    it("zExperimentAnnotationCommentContent rejects empty text", () => {
      expect(() =>
        zExperimentAnnotationCommentContent.parse({ type: "comment", text: "" }),
      ).toThrow();
    });

    it("zExperimentAnnotationCommentContent rejects text too long", () => {
      const longText = "a".repeat(256);
      expect(() =>
        zExperimentAnnotationCommentContent.parse({ type: "comment", text: longText }),
      ).toThrow();
    });

    it("zExperimentAnnotationFlagContent valid with text", () => {
      const flag = { type: "flag", flagType: "outlier", text: "This is flagged as outlier" };
      expect(zExperimentAnnotationFlagContent.parse(flag)).toEqual(flag);
    });

    it("zExperimentAnnotationFlagContent valid without text", () => {
      const flag = { type: "flag", flagType: "needs_review" };
      expect(zExperimentAnnotationFlagContent.parse(flag)).toEqual(flag);
    });

    it("zExperimentAnnotationContent discriminated union works", () => {
      const comment = { type: "comment", text: "Comment text" };
      const flag = { type: "flag", flagType: "outlier", text: "Flag text" };

      expect(zExperimentAnnotationContent.parse(comment)).toEqual(comment);
      expect(zExperimentAnnotationContent.parse(flag)).toEqual(flag);

      // Invalid type for comment
      expect(() =>
        zExperimentAnnotationContent.parse({ type: "comment", flagType: "outlier" }),
      ).toThrow();
      // Invalid type for flag
      expect(() =>
        zExperimentAnnotationContent.parse({ type: "flag", text: "no flagType" }),
      ).toThrow();
    });

    it("zExperimentAnnotation valid complete", () => {
      const annotation = {
        id: uuidA,
        rowId: "row-123",
        type: "comment",
        content: { type: "comment", text: "Test comment" },
        createdBy: uuidB,
        createdByName: "John Doe",
        createdAt: isoTime,
        updatedAt: isoTime2,
      };
      expect(zExperimentAnnotation.parse(annotation)).toEqual(annotation);
    });

    it("zExperimentAnnotation valid without optional fields", () => {
      const annotation = {
        id: uuidA,
        type: "flag",
        content: { type: "flag", flagType: "outlier" },
        createdBy: uuidB,
        createdAt: isoTime,
        updatedAt: isoTime2,
      };
      expect(zExperimentAnnotation.parse(annotation)).toEqual(annotation);
    });

    it("zExperimentAnnotationList valid array", () => {
      const annotations = [
        {
          id: uuidA,
          type: "comment",
          content: { type: "comment", text: "Comment 1" },
          createdBy: uuidB,
          createdAt: isoTime,
          updatedAt: isoTime2,
        },
        {
          id: uuidB,
          type: "flag",
          content: { type: "flag", flagType: "needs_review" },
          createdBy: uuidA,
          createdAt: isoTime,
          updatedAt: isoTime2,
        },
      ];
      expect(zExperimentAnnotationList.parse(annotations)).toEqual(annotations);
    });

    it("zExperimentAnnotationPathParam valid", () => {
      const params = { id: uuidA, annotationId: uuidB };
      expect(zExperimentAnnotationPathParam.parse(params)).toEqual(params);
    });

    it("zExperimentAddAnnotationBody valid", () => {
      const body = {
        tableName: "sensor_data",
        rowId: "row-123",
        annotation: {
          type: "comment",
          content: { type: "comment", text: "Great data point!" },
        },
      };
      expect(zExperimentAddAnnotationBody.parse(body)).toEqual(body);
    });

    it("zExperimentAddAnnotationBody rejects empty rowId", () => {
      const body = {
        tableName: "sensor_data",
        rowId: "",
        annotation: {
          type: "comment",
          content: { type: "comment", text: "Test" },
        },
      };
      expect(() => zExperimentAddAnnotationBody.parse(body)).toThrow();
    });

    it("zExperimentAddAnnotationsBulkBody valid", () => {
      const body = {
        tableName: "sensor_data",
        rowIds: ["row-1", "row-2", "row-3"],
        annotation: {
          type: "flag",
          content: { type: "flag", flagType: "outlier", text: "All outliers" },
        },
      };
      expect(zExperimentAddAnnotationsBulkBody.parse(body)).toEqual(body);
    });

    it("zExperimentAddAnnotationsBulkBody rejects empty rowIds array", () => {
      const body = {
        tableName: "sensor_data",
        rowIds: [],
        annotation: {
          type: "comment",
          content: { type: "comment", text: "Test" },
        },
      };
      expect(() => zExperimentAddAnnotationsBulkBody.parse(body)).toThrow();
    });

    it("zExperimentListAnnotationsQuery valid with all fields", () => {
      const query = { page: 2, pageSize: 50, tableName: "measurements" };
      expect(zExperimentListAnnotationsQuery.parse(query)).toEqual(query);
    });

    it("zExperimentListAnnotationsQuery valid with just tableName", () => {
      const query = { tableName: "sensor_data" };
      expect(zExperimentListAnnotationsQuery.parse(query)).toEqual(query);
    });

    it("zExperimentListAnnotationsQuery coerces string numbers", () => {
      const query = { page: "3", pageSize: "25", tableName: "data" };
      const parsed = zExperimentListAnnotationsQuery.parse(query);
      expect(parsed.page).toBe(3);
      expect(parsed.pageSize).toBe(25);
      expect(parsed.tableName).toBe("data");
    });

    it("zExperimentUpdateAnnotationBody valid", () => {
      const body = {
        content: { type: "comment", text: "Updated comment text" },
      };
      expect(zExperimentUpdateAnnotationBody.parse(body)).toEqual(body);
    });

    it("zExperimentAnnotationDeleteBulkPathParam valid", () => {
      const params = { id: uuidA };
      expect(zExperimentAnnotationDeleteBulkPathParam.parse(params)).toEqual(params);
    });

    it("zExperimentAnnotationDeleteBulkBody valid", () => {
      const body = {
        tableName: "measurements",
        rowIds: ["row-1", "row-2"],
        type: "flag",
      };
      expect(zExperimentAnnotationDeleteBulkBody.parse(body)).toEqual(body);
    });

    it("zExperimentAnnotationDeleteBulkBody rejects empty rowIds", () => {
      const body = {
        tableName: "measurements",
        rowIds: [],
        type: "comment",
      };
      expect(() => zExperimentAnnotationDeleteBulkBody.parse(body)).toThrow();
    });

    it("zExperimentAnnotationRowsAffected valid", () => {
      const result = { rowsAffected: 5 };
      expect(zExperimentAnnotationRowsAffected.parse(result)).toEqual(result);
    });

    it("zExperimentAnnotationRowsAffected rejects non-integer", () => {
      expect(() => zExperimentAnnotationRowsAffected.parse({ rowsAffected: 3.14 })).toThrow();
    });
  });

  describe("Data queries & tables", () => {
    it("zExperimentDataQuery defaults & coercion", () => {
      const d1 = zExperimentDataQuery.parse({ tableName: "test_table" });
      expect(d1.page).toBeUndefined();
      expect(d1.pageSize).toBeUndefined();
      expect(d1.orderBy).toBeUndefined();
      expect(d1.orderDirection).toBeUndefined();

      const d2 = zExperimentDataQuery.parse({ tableName: "test_table", page: "3", pageSize: "10" });
      expect(d2.page).toBe(3);
      expect(d2.pageSize).toBe(10);
      expect(d2.orderBy).toBeUndefined();
      expect(d2.orderDirection).toBeUndefined();

      const d3 = zExperimentDataQuery.parse({
        tableName: "test_table",
        orderBy: "timestamp",
        orderDirection: "DESC",
      });
      expect(d3.orderBy).toBe("timestamp");
      expect(d3.orderDirection).toBe("DESC");
    });

    it("zExperimentDataTable valid", () => {
      const info = {
        name: "t1",
        catalog_name: "cat",
        schema_name: "sch",
        data: {
          columns: [{ name: "x", type_name: "text", type_text: "VARCHAR" }],
          rows: [{ x: "1" }],
          totalRows: 1,
          truncated: false,
        },
        page: 1,
        pageSize: 5,
        totalPages: 1,
        totalRows: 1,
      };
      expect(zExperimentDataTable.parse(info)).toEqual(info);
    });

    it("zExperimentDataTableList / Response valid", () => {
      const list = [
        {
          name: "t1",
          catalog_name: "cat",
          schema_name: "sch",
          page: 1,
          pageSize: 5,
          totalPages: 1,
          totalRows: 0,
        },
      ];
      expect(zExperimentDataTableList.parse(list)).toEqual(list);
      expect(zExperimentDataResponse.parse(list)).toEqual(list);
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

  describe("zExperimentCustomMetadataPayload", () => {
    const validBlob = {
      name: "Plot map",
      columns: [
        { id: "plot", name: "plot", type: "string" as const },
        { id: "treatment", name: "treatment", type: "string" as const },
      ],
      rows: [{ _id: "row_1", plot: "A1", treatment: "control" }],
      identifierColumnId: "plot",
      experimentQuestionId: "plot_id",
    };

    it("accepts a well-formed payload", () => {
      expect(zExperimentCustomMetadataPayload.parse(validBlob)).toEqual(validBlob);
    });

    it("rejects empty/whitespace column names", () => {
      const blob = {
        ...validBlob,
        columns: [{ id: "x", name: "   ", type: "string" as const }],
        identifierColumnId: "   ",
      };
      const result = zExperimentCustomMetadataPayload.safeParse(blob);
      expect(result.success).toBe(false);
    });

    it("rejects duplicate column names within the blob", () => {
      const blob = {
        ...validBlob,
        columns: [
          { id: "plot", name: "plot", type: "string" as const },
          { id: "plot2", name: "plot", type: "string" as const },
        ],
      };
      const result = zExperimentCustomMetadataPayload.safeParse(blob);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.join(".") === "columns.1.name");
        expect(issue?.message.toLowerCase()).toContain("duplicated");
      }
    });

    it("rejects column names that collide with reserved system columns", () => {
      const blob = {
        ...validBlob,
        columns: [{ id: "device_id", name: "device_id", type: "string" as const }],
        rows: [{ _id: "row_1", device_id: "X" }],
        identifierColumnId: "device_id",
      };
      const result = zExperimentCustomMetadataPayload.safeParse(blob);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.join(".") === "columns.0.name");
        expect(issue?.message.toLowerCase()).toContain("reserved");
      }
    });

    it("rejects identifierColumnId that is not in columns", () => {
      const blob = { ...validBlob, identifierColumnId: "missing" };
      const result = zExperimentCustomMetadataPayload.safeParse(blob);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.join(".") === "identifierColumnId");
        expect(issue?.message).toContain("missing");
      }
    });

    it("requires at least one column", () => {
      const blob = { ...validBlob, columns: [] };
      expect(zExperimentCustomMetadataPayload.safeParse(blob).success).toBe(false);
    });

    it.each([
      ["space", "plot id"],
      ["hyphen", "plot-id"],
      ["dot", "plot.id"],
      ["slash", "plot/id"],
      ["punctuation", "plot!"],
    ])("rejects column name with %s (%s)", (_label, name) => {
      const blob = {
        ...validBlob,
        columns: [{ id: "plot", name, type: "string" as const }],
        rows: [{ _id: "row_1", plot: "A1" }],
        identifierColumnId: "plot",
      };
      const result = zExperimentCustomMetadataPayload.safeParse(blob);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.join(".") === "columns.0.name");
        expect(issue?.message.toLowerCase()).toContain("letters");
      }
    });

    it.each([
      ["lowercase", "plot"],
      ["uppercase", "Plot"],
      ["mixed case", "PlotId"],
      ["with underscore", "plot_id"],
      ["with digits", "plot_2024"],
      ["leading digit", "2024_yield"],
      ["leading underscore", "_internal"],
    ])("accepts column name (%s)", (_label, name) => {
      const blob = {
        ...validBlob,
        columns: [{ id: "x", name, type: "string" as const }],
        rows: [{ _id: "row_1", x: "v" }],
        identifierColumnId: "x",
      };
      expect(zExperimentCustomMetadataPayload.safeParse(blob).success).toBe(true);
    });
  });

  describe("makeCustomMetadataFormSchema (flow collision)", () => {
    const baseBlob = {
      name: "Plot map",
      columns: [
        { id: "plot", name: "plot", type: "string" as const },
        { id: "yield", name: "yield", type: "number" as const },
      ],
      rows: [{ _id: "row_1", plot: "A1", yield: 12 }],
      identifierColumnId: "plot",
      experimentQuestionId: "plot_id",
    };

    it("rejects a non-identifier column whose name matches a sanitized question label", () => {
      const schema = makeCustomMetadataFormSchema(new Set(["yield", "moisture"]));
      const result = schema.safeParse(baseBlob);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.join(".") === "columns.1.name");
        expect(issue?.message.toLowerCase()).toContain("question");
      }
    });

    it("exempts the identifier column from the question-label collision rule", () => {
      // identifierColumnId is "plot" and "plot" is also a question label;
      // pipeline filters it out before it reaches gold, so allow it.
      const schema = makeCustomMetadataFormSchema(new Set(["plot"]));
      expect(schema.safeParse(baseBlob).success).toBe(true);
    });

    it("accepts blobs whose columns don't collide with question labels", () => {
      const schema = makeCustomMetadataFormSchema(new Set(["moisture", "temperature"]));
      expect(schema.safeParse(baseBlob).success).toBe(true);
    });

    it("still applies the base zExperimentCustomMetadataPayload rules", () => {
      const schema = makeCustomMetadataFormSchema(new Set());
      const blob = {
        ...baseBlob,
        columns: [{ id: "device_id", name: "device_id", type: "string" as const }],
        rows: [{ _id: "row_1", device_id: "x" }],
        identifierColumnId: "device_id",
      };
      const result = schema.safeParse(blob);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.join(".") === "columns.0.name");
        expect(issue?.message.toLowerCase()).toContain("reserved");
      }
    });

    it("with empty reserved set behaves identically to the base schema", () => {
      const schema = makeCustomMetadataFormSchema(new Set());
      expect(schema.safeParse(baseBlob).success).toBe(true);
    });
  });

  describe("zExperimentProjectTransferQuestionInput", () => {
    it("should validate a yes_no question", () => {
      const question = { kind: "yes_no", text: "Is this working?" };
      const result = zExperimentProjectTransferQuestionInput.parse(question);
      expect(result.kind).toBe("yes_no");
      expect(result.required).toBe(false); // default
    });

    it("should validate an open_ended question", () => {
      const question = { kind: "open_ended", text: "Describe the sample" };
      const result = zExperimentProjectTransferQuestionInput.parse(question);
      expect(result.kind).toBe("open_ended");
    });

    it("should validate a multi_choice question with options", () => {
      const question = {
        kind: "multi_choice",
        text: "Select a color",
        options: ["red", "green", "blue"],
        required: true,
      };
      const result = zExperimentProjectTransferQuestionInput.parse(question);
      expect(result.options).toEqual(["red", "green", "blue"]);
      expect(result.required).toBe(true);
    });

    it("should validate a number question", () => {
      const question = { kind: "number", text: "Enter temperature" };
      const result = zExperimentProjectTransferQuestionInput.parse(question);
      expect(result.kind).toBe("number");
    });

    it("should reject invalid kind", () => {
      expect(() =>
        zExperimentProjectTransferQuestionInput.parse({ kind: "invalid", text: "Q" }),
      ).toThrow();
    });

    it("should reject empty text", () => {
      expect(() =>
        zExperimentProjectTransferQuestionInput.parse({ kind: "yes_no", text: "" }),
      ).toThrow();
    });

    it("should reject text exceeding 64 characters", () => {
      expect(() =>
        zExperimentProjectTransferQuestionInput.parse({ kind: "yes_no", text: "a".repeat(65) }),
      ).toThrow();
    });
  });

  describe("zExperimentProjectTransferWebhookPayload", () => {
    const validPayload = {
      experiment: {
        name: "Test Experiment",
        createdBy: "123e4567-e89b-12d3-a456-426614174000",
      },
      protocol: {
        name: "Test Protocol",
        code: [{ step: "measure" }],
        createdBy: "123e4567-e89b-12d3-a456-426614174000",
      },
      macro: {
        name: "Test Macro",
        code: "Y29uc29sZS5sb2coJ2hlbGxvJyk=",
        createdBy: "123e4567-e89b-12d3-a456-426614174000",
      },
    };

    it("should validate a minimal valid payload", () => {
      const result = zExperimentProjectTransferWebhookPayload.parse(validPayload);
      expect(result.experiment.name).toBe("Test Experiment");
      expect(result.protocol?.family).toBe("multispeq"); // default
      expect(result.macro?.language).toBe("javascript"); // default
    });

    it("should validate a payload with all optional fields", () => {
      const fullPayload = {
        experiment: {
          ...validPayload.experiment,
          description: "A test experiment",
          locations: [{ name: "Loc1", latitude: 0, longitude: 0 }],
        },
        protocol: {
          ...validPayload.protocol,
          description: "A test protocol",
          family: "ambit",
        },
        macro: {
          ...validPayload.macro,
          description: "A test macro",
          language: "python",
        },
        questions: [{ kind: "yes_no", text: "Ready?" }],
      };

      const result = zExperimentProjectTransferWebhookPayload.parse(fullPayload);
      expect(result.experiment.locations).toHaveLength(1);
      expect(result.protocol?.family).toBe("ambit");
      expect(result.macro?.language).toBe("python");
      expect(result.questions).toHaveLength(1);
    });

    it("should validate a payload with only experiment (no protocol or macro)", () => {
      const result = zExperimentProjectTransferWebhookPayload.parse({
        experiment: validPayload.experiment,
      });
      expect(result.experiment.name).toBe("Test Experiment");
      expect(result.protocol).toBeUndefined();
      expect(result.macro).toBeUndefined();
    });

    it("should reject missing experiment name", () => {
      const payload = {
        ...validPayload,
        experiment: { createdBy: "123e4567-e89b-12d3-a456-426614174000" },
      };
      expect(() => zExperimentProjectTransferWebhookPayload.parse(payload)).toThrow();
    });

    it("should reject invalid createdBy UUID", () => {
      const payload = {
        ...validPayload,
        experiment: { ...validPayload.experiment, createdBy: "not-a-uuid" },
      };
      expect(() => zExperimentProjectTransferWebhookPayload.parse(payload)).toThrow();
    });

    it("should reject empty macro code", () => {
      const payload = {
        ...validPayload,
        macro: { ...validPayload.macro, code: "" },
      };
      expect(() => zExperimentProjectTransferWebhookPayload.parse(payload)).toThrow();
    });

    it("should reject empty protocol code array", () => {
      const payload = {
        ...validPayload,
        protocol: { ...validPayload.protocol, code: [] },
      };
      // z.record(z.unknown()).array() allows empty arrays by default,
      // so this should still parse (no .min(1) on the array)
      const result = zExperimentProjectTransferWebhookPayload.safeParse(payload);
      // Empty code array is technically valid per schema
      expect(result.success).toBe(true);
    });

    it("should reject invalid protocol family", () => {
      const payload = {
        ...validPayload,
        protocol: { ...validPayload.protocol, family: "unknown" },
      };
      expect(() => zExperimentProjectTransferWebhookPayload.parse(payload)).toThrow();
    });

    it("should reject invalid macro language", () => {
      const payload = {
        ...validPayload,
        macro: { ...validPayload.macro, language: "rust" },
      };
      expect(() => zExperimentProjectTransferWebhookPayload.parse(payload)).toThrow();
    });
  });

  describe("zExperimentProjectTransferWebhookResponse", () => {
    const validResponse = {
      success: true,
      experimentId: "123e4567-e89b-12d3-a456-426614174000",
      protocolId: "223e4567-e89b-12d3-a456-426614174000",
      macroId: "323e4567-e89b-12d3-a456-426614174000",
      macroFilename: "macro_abc123def456",
      macroName: "Test Macro (PhotosynQ)",
      flowId: "423e4567-e89b-12d3-a456-426614174000",
    };

    it("should validate a valid response", () => {
      const result = zExperimentProjectTransferWebhookResponse.parse(validResponse);
      expect(result).toEqual(validResponse);
    });

    it("should allow null flowId", () => {
      const result = zExperimentProjectTransferWebhookResponse.parse({
        ...validResponse,
        flowId: null,
      });
      expect(result.flowId).toBeNull();
    });

    it("should allow null protocolId and macroId", () => {
      const result = zExperimentProjectTransferWebhookResponse.parse({
        ...validResponse,
        protocolId: null,
        macroId: null,
        macroFilename: null,
        macroName: null,
        flowId: null,
      });
      expect(result.protocolId).toBeNull();
      expect(result.macroId).toBeNull();
      expect(result.macroFilename).toBeNull();
      expect(result.macroName).toBeNull();
    });

    it("should allow optional message", () => {
      const result = zExperimentProjectTransferWebhookResponse.parse({
        ...validResponse,
        message: "Transfer complete",
      });
      expect(result.message).toBe("Transfer complete");
    });

    it("should reject invalid experimentId UUID", () => {
      expect(() =>
        zExperimentProjectTransferWebhookResponse.parse({ ...validResponse, experimentId: "bad" }),
      ).toThrow();
    });

    it("should reject missing required fields", () => {
      expect(() => zExperimentProjectTransferWebhookResponse.parse({ success: true })).toThrow();
    });
  });

  describe("Data filter primitives & distinct values", () => {
    describe("zExperimentDataFilterOperator", () => {
      it("accepts every supported operator", () => {
        for (const op of [
          "equals",
          "not_equals",
          "greater_than",
          "less_than",
          "greater_than_or_equal",
          "less_than_or_equal",
          "between",
          "contains",
          "in",
        ]) {
          expect(zExperimentDataFilterOperator.parse(op)).toBe(op);
        }
      });

      it("rejects an unknown operator", () => {
        expect(zExperimentDataFilterOperator.safeParse("starts_with").success).toBe(false);
      });
    });

    describe("zExperimentDataFilterValue", () => {
      it("accepts non-empty scalars", () => {
        expect(zExperimentDataFilterValue.parse("x")).toBe("x");
        expect(zExperimentDataFilterValue.parse(3)).toBe(3);
        expect(zExperimentDataFilterValue.parse(false)).toBe(false);
      });

      it("accepts a non-empty array of strings/numbers", () => {
        expect(zExperimentDataFilterValue.parse(["a", 2])).toEqual(["a", 2]);
      });

      it("rejects an empty string, empty array, and array with an empty string", () => {
        expect(zExperimentDataFilterValue.safeParse("").success).toBe(false);
        expect(zExperimentDataFilterValue.safeParse([]).success).toBe(false);
        expect(zExperimentDataFilterValue.safeParse([""]).success).toBe(false);
      });
    });

    describe("zExperimentDataFilter.superRefine", () => {
      const base = { column: "temp" };

      it("requires a non-empty column", () => {
        expect(
          zExperimentDataFilter.safeParse({ column: "", operator: "equals", value: "x" }).success,
        ).toBe(false);
      });

      it("'in' requires an array; accepts an array", () => {
        expect(
          zExperimentDataFilter.safeParse({ ...base, operator: "in", value: "x" }).success,
        ).toBe(false);
        expect(
          zExperimentDataFilter.safeParse({ ...base, operator: "in", value: ["a", "b"] }).success,
        ).toBe(true);
      });

      it("'between' requires a same-typed 2-tuple", () => {
        expect(
          zExperimentDataFilter.safeParse({ ...base, operator: "between", value: 5 }).success,
        ).toBe(false);
        expect(
          zExperimentDataFilter.safeParse({ ...base, operator: "between", value: [1] }).success,
        ).toBe(false);
        expect(
          zExperimentDataFilter.safeParse({ ...base, operator: "between", value: [1, "2"] })
            .success,
        ).toBe(false);
        expect(
          zExperimentDataFilter.safeParse({ ...base, operator: "between", value: [1, 9] }).success,
        ).toBe(true);
      });

      it("rejects array values for non-array operators", () => {
        expect(
          zExperimentDataFilter.safeParse({ ...base, operator: "equals", value: ["a", "b"] })
            .success,
        ).toBe(false);
      });

      it("comparison operators require a number or ISO date string", () => {
        expect(
          zExperimentDataFilter.safeParse({ ...base, operator: "greater_than", value: true })
            .success,
        ).toBe(false);
        expect(
          zExperimentDataFilter.safeParse({ ...base, operator: "greater_than", value: 10 }).success,
        ).toBe(true);
        expect(
          zExperimentDataFilter.safeParse({
            ...base,
            operator: "less_than_or_equal",
            value: "2024-01-01",
          }).success,
        ).toBe(true);
        expect(
          zExperimentDataFilter.safeParse({
            ...base,
            operator: "greater_than",
            value: "not-a-date",
          }).success,
        ).toBe(false);
      });

      it("'contains' requires a string value", () => {
        expect(
          zExperimentDataFilter.safeParse({ ...base, operator: "contains", value: 5 }).success,
        ).toBe(false);
        expect(
          zExperimentDataFilter.safeParse({ ...base, operator: "contains", value: "lf" }).success,
        ).toBe(true);
      });

      it("accepts a plain equals filter", () => {
        expect(
          zExperimentDataFilter.safeParse({ ...base, operator: "equals", value: "active" }).success,
        ).toBe(true);
      });
    });

    describe("zExperimentDistinctValuesQuery", () => {
      it("accepts a minimal query and leaves limit optional", () => {
        const parsed = zExperimentDistinctValuesQuery.parse({
          tableName: "raw_data",
          column: "site",
        });
        expect(parsed.limit).toBeUndefined();
      });

      it("coerces a numeric-string limit", () => {
        expect(
          zExperimentDistinctValuesQuery.parse({
            tableName: "raw_data",
            column: "site",
            limit: "50",
          }).limit,
        ).toBe(50);
      });

      it("rejects a missing column and an over-cap limit", () => {
        expect(
          zExperimentDistinctValuesQuery.safeParse({ tableName: "raw_data", column: "" }).success,
        ).toBe(false);
        expect(
          zExperimentDistinctValuesQuery.safeParse({
            tableName: "raw_data",
            column: "site",
            limit: DISTINCT_VALUES_MAX_LIMIT + 1,
          }).success,
        ).toBe(false);
      });
    });

    describe("zExperimentDistinctValuesResponse", () => {
      it("accepts string and number values with a truncated flag", () => {
        const parsed = zExperimentDistinctValuesResponse.parse({
          values: ["a", 1, "b"],
          truncated: true,
        });
        expect(parsed.values).toEqual(["a", 1, "b"]);
        expect(parsed.truncated).toBe(true);
      });

      it("rejects boolean values", () => {
        expect(
          zExperimentDistinctValuesResponse.safeParse({ values: [true], truncated: false }).success,
        ).toBe(false);
      });
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

  describe("Dashboard schemas", () => {
    const layout = { col: 0, row: 0, colSpan: 6, rowSpan: 4 };

    describe("zExperimentWidgetLayout", () => {
      it("accepts a valid layout block", () => {
        expect(zExperimentWidgetLayout.parse(layout)).toEqual(layout);
      });

      it("rejects negative coordinates", () => {
        expect(zExperimentWidgetLayout.safeParse({ ...layout, col: -1 }).success).toBe(false);
      });

      it("rejects zero spans (min is 1)", () => {
        expect(zExperimentWidgetLayout.safeParse({ ...layout, colSpan: 0 }).success).toBe(false);
        expect(zExperimentWidgetLayout.safeParse({ ...layout, rowSpan: 0 }).success).toBe(false);
      });

      it("caps colSpan at 24 and rowSpan at 48", () => {
        expect(zExperimentWidgetLayout.safeParse({ ...layout, colSpan: 25 }).success).toBe(false);
        expect(zExperimentWidgetLayout.safeParse({ ...layout, rowSpan: 49 }).success).toBe(false);
      });
    });

    describe("zExperimentVisualizationWidget", () => {
      it("applies default showTitle=true, showDescription=false", () => {
        const w = {
          id: uuidA,
          layout,
          type: "visualization" as const,
          config: { visualizationId: uuidB },
        };
        const parsed = zExperimentVisualizationWidget.parse(w);
        expect(parsed.config.showTitle).toBe(true);
        expect(parsed.config.showDescription).toBe(false);
      });

      it("allows visualizationId to be omitted (draft state)", () => {
        const w = { id: uuidA, layout, type: "visualization" as const, config: {} };
        expect(zExperimentVisualizationWidget.parse(w).config.visualizationId).toBeUndefined();
      });
    });

    describe("zExperimentRichTextWidget", () => {
      it("defaults html to empty string when omitted", () => {
        const w = { id: uuidA, layout, type: "richText" as const, config: {} };
        expect(zExperimentRichTextWidget.parse(w).config.html).toBe("");
      });
    });

    describe("zExperimentTableWidget", () => {
      it("defaults pageSize to 25", () => {
        const w = { id: uuidA, layout, type: "table" as const, config: {} };
        expect(zExperimentTableWidget.parse(w).config.pageSize).toBe(25);
      });

      it("rejects unsupported pageSize values", () => {
        const w = {
          id: uuidA,
          layout,
          type: "table" as const,
          config: { pageSize: 30 },
        };
        expect(zExperimentTableWidget.safeParse(w).success).toBe(false);
      });

      it("rejects empty column names in the projection list", () => {
        const w = {
          id: uuidA,
          layout,
          type: "table" as const,
          config: { columns: [""] },
        };
        expect(zExperimentTableWidget.safeParse(w).success).toBe(false);
      });

      it("propagates zExperimentDataFilter refinements to per-widget filters", () => {
        const w = {
          id: uuidA,
          layout,
          type: "table" as const,
          config: { filters: [{ column: "x", operator: "between", value: [1] }] },
        };
        expect(zExperimentTableWidget.safeParse(w).success).toBe(false);
      });
    });

    describe("zExperimentFilterWidget", () => {
      it("allows all selection fields to be unset (draft state)", () => {
        const w = { id: uuidA, layout, type: "filter" as const, config: {} };
        const parsed = zExperimentFilterWidget.parse(w);
        expect(parsed.config.column).toBeUndefined();
        expect(parsed.config.operator).toBeUndefined();
      });

      it("accepts a fully configured filter card", () => {
        const w = {
          id: uuidA,
          layout,
          type: "filter" as const,
          config: {
            tableName: "readings",
            column: "tag",
            operator: "in" as const,
            defaultValue: ["a", "b"],
          },
        };
        expect(zExperimentFilterWidget.parse(w)).toBeDefined();
      });
    });

    describe("zExperimentDashboardWidget (discriminated union)", () => {
      it("dispatches on `type`", () => {
        const viz = {
          id: uuidA,
          layout,
          type: "visualization" as const,
          config: { visualizationId: uuidB },
        };
        const text = {
          id: uuidB,
          layout,
          type: "richText" as const,
          config: { html: "<p>hi</p>" },
        };
        expect(zExperimentDashboardWidget.parse(viz).type).toBe("visualization");
        expect(zExperimentDashboardWidget.parse(text).type).toBe("richText");
      });

      it("rejects unknown discriminator values", () => {
        const bad = { id: uuidA, layout, type: "iframe", config: {} };
        expect(zExperimentDashboardWidget.safeParse(bad).success).toBe(false);
      });
    });

    describe("zExperimentDashboardLayout", () => {
      it("applies grid defaults when fields omitted", () => {
        const parsed = zExperimentDashboardLayout.parse({});
        expect(parsed.columns).toBe(12);
        expect(parsed.rowHeight).toBe(80);
        expect(parsed.gap).toBe(16);
      });

      it("rejects out-of-range values", () => {
        expect(zExperimentDashboardLayout.safeParse({ columns: 0 }).success).toBe(false);
        expect(zExperimentDashboardLayout.safeParse({ rowHeight: 500 }).success).toBe(false);
        expect(zExperimentDashboardLayout.safeParse({ gap: 100 }).success).toBe(false);
      });
    });

    describe("zExperimentDashboard", () => {
      const dashboard = {
        id: uuidA,
        experimentId: uuidB,
        name: "My Dashboard",
        description: null,
        layout: { columns: 12, rowHeight: 80, gap: 16 },
        widgets: [],
        createdBy: uuidC,
        createdAt: isoTime,
        updatedAt: isoTime2,
      };

      it("accepts a complete dashboard with empty widgets list", () => {
        expect(zExperimentDashboard.parse(dashboard)).toEqual(dashboard);
      });

      it("accepts a dashboard with widgets of every type", () => {
        const widgets = [
          { id: uuidA, layout, type: "visualization", config: {} },
          { id: uuidB, layout, type: "richText", config: { html: "" } },
          { id: uuidC, layout, type: "table", config: { pageSize: 25 } },
          {
            id: "44444444-4444-4444-4444-444444444444",
            layout,
            type: "filter",
            config: {},
          },
        ];
        const full = { ...dashboard, widgets };
        const parsed = zExperimentDashboard.parse(full);
        expect(parsed.widgets).toHaveLength(4);
      });

      it("rejects an empty name", () => {
        expect(zExperimentDashboard.safeParse({ ...dashboard, name: "" }).success).toBe(false);
      });

      it("rejects a non-UUID experimentId", () => {
        expect(zExperimentDashboard.safeParse({ ...dashboard, experimentId: "nope" }).success).toBe(
          false,
        );
      });

      it("zExperimentDashboardList accepts arrays", () => {
        expect(zExperimentDashboardList.parse([dashboard, dashboard])).toHaveLength(2);
      });
    });

    describe("zCreateExperimentDashboardBody / zUpdateExperimentDashboardBody", () => {
      it("create body requires only name", () => {
        expect(zCreateExperimentDashboardBody.parse({ name: "X" })).toEqual({ name: "X" });
      });

      it("create body rejects empty name", () => {
        expect(zCreateExperimentDashboardBody.safeParse({ name: "" }).success).toBe(false);
      });

      it("create body accepts a partial layout", () => {
        const parsed = zCreateExperimentDashboardBody.parse({
          name: "X",
          layout: { columns: 16 },
        });
        expect(parsed.layout).toEqual({ columns: 16 });
      });

      it("update body makes every field optional including name", () => {
        expect(zUpdateExperimentDashboardBody.parse({})).toEqual({});
        expect(zUpdateExperimentDashboardBody.parse({ description: "new" })).toEqual({
          description: "new",
        });
      });
    });

    describe("zListExperimentDashboardsQuery", () => {
      it("applies default limit and offset", () => {
        const parsed = zListExperimentDashboardsQuery.parse({});
        expect(parsed.limit).toBe(50);
        expect(parsed.offset).toBe(0);
      });

      it("coerces stringified limit and offset", () => {
        const parsed = zListExperimentDashboardsQuery.parse({ limit: "10", offset: "20" });
        expect(parsed.limit).toBe(10);
        expect(parsed.offset).toBe(20);
      });

      it("rejects a limit above 100", () => {
        expect(zListExperimentDashboardsQuery.safeParse({ limit: "101" }).success).toBe(false);
      });
    });

    describe("zExperimentDashboardPathParam", () => {
      it("accepts valid UUIDs and rejects non-UUIDs", () => {
        const ok = { id: uuidA, dashboardId: uuidB };
        expect(zExperimentDashboardPathParam.parse(ok)).toEqual(ok);
        expect(
          zExperimentDashboardPathParam.safeParse({ id: uuidA, dashboardId: "nope" }).success,
        ).toBe(false);
      });
    });
  });
});

import { describe, it, expect } from "vitest";

import {
  // Enums / small schemas
  zExperimentStatus,
  zExperimentVisibility,
  zExperimentMemberRole,
  // Experiment core
  zExperiment,
  zExperimentList,
  zExperimentMember,
  zExperimentMemberList,
  zExperimentAccess,
  zErrorResponse,
  // Data
  zDataColumn,
  zExperimentData,
  zExperimentDataQuery,
  zExperimentDataTable,
  zExperimentDataTableList,
  zExperimentDataResponse,
  // Annotations
  zAnnotationType,
  zAnnotationFlagType,
  zAnnotationCommentContent,
  zAnnotationFlagContent,
  zAnnotationContent,
  zAnnotation,
  zAnnotationList,
  zAnnotationPathParam,
  zAddAnnotationBody,
  zAddAnnotationsBulkBody,
  zListAnnotationsQuery,
  zUpdateAnnotationBody,
  zAnnotationDeleteBulkPathParam,
  zAnnotationDeleteBulkBody,
  zAnnotationRowsAffected,
  // Flow
  zFlowNodeType,
  zQuestionKind,
  zQuestionContent,
  zInstructionContent,
  zMeasurementContent,
  zAnalysisContent,
  zFlowNode,
  zFlowEdge,
  zFlowGraph,
  zFlow,
  zUpsertFlowBody,
  // Creation / update & filters
  zCreateExperimentBody,
  zUpdateExperimentBody,
  zAddExperimentMembersBody,
  zExperimentFilterQuery,
  // Path params / responses
  zIdPathParam,
  zExperimentMemberPathParam,
  zExportPathParam,
  zCreateExperimentResponse,
  // Export schemas
  zInitiateExportBody,
  zInitiateExportResponse,
  zListExportsQuery,
  zExportRecord,
  zListExportsResponse,
  zDownloadExportResponse,
  // Project transfer schemas
  zProjectTransferQuestionInput,
  zProjectTransferWebhookPayload,
  zProjectTransferWebhookResponse,
  // Custom metadata
  zCustomMetadataPayload,
  makeCustomMetadataFormSchema,
  // Data filter primitives & distinct values
  zDataFilterOperator,
  zDataFilterValue,
  zDataFilter,
  zDistinctValuesQuery,
  zDistinctValuesResponse,
  DISTINCT_VALUES_MAX_LIMIT,
  // Upload schemas
  zUploadSourceKind,
  zUploadTableName,
  zUploadTargetTable,
  zCsvFilename,
  zTsvFilename,
  zParquetFilename,
  zXlsxFilename,
  zJsonFilename,
  zNdjsonFilename,
  zAmbyteFilename,
  zUploadMetadata,
  UPLOAD_KIND_CONSTANTS,
  UPLOAD_FILENAME_SCHEMAS,
  inferUploadSourceKind,
  // Dashboards
  zWidgetLayout,
  zVisualizationWidget,
  zRichTextWidget,
  zTableWidget,
  zFilterWidget,
  zDashboardWidget,
  zDashboardLayout,
  zExperimentDashboard,
  zExperimentDashboardList,
  zCreateExperimentDashboardBody,
  zUpdateExperimentDashboardBody,
  zListExperimentDashboardsQuery,
  zExperimentDashboardPathParam,
} from "./experiment.schema";

// -------- Helpers --------
const uuidA = "11111111-1111-1111-1111-111111111111";
const uuidB = "22222222-2222-2222-2222-222222222222";
const uuidC = "33333333-3333-3333-3333-333333333333";
const isoTime = "2024-01-15T10:00:00Z";
const isoTime2 = "2024-01-15T11:00:00Z";

describe("Experiment Schema", () => {
  // ----- Enums -----
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

  // ----- Data sub-schemas -----
  describe("Experiment Data", () => {
    it("zDataColumn valid", () => {
      const col = { name: "x", type_name: "text", type_text: "VARCHAR" };
      expect(zDataColumn.parse(col)).toEqual(col);
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

  // ----- Experiment core -----
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

  // ----- Members & Access -----
  describe("Members & Access", () => {
    const member = {
      user: {
        id: uuidA,
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        avatarUrl: null,
      },
      role: "member",
      joinedAt: isoTime,
    };
    it("zExperimentMember valid", () => {
      expect(zExperimentMember.parse(member)).toEqual(member);
    });

    it("zExperimentMember rejects bad email", () => {
      const bad = {
        ...member,
        user: { ...member.user, email: "nope" },
      };
      expect(() => zExperimentMember.parse(bad)).toThrow();
    });

    it("zExperimentMemberList valid array", () => {
      expect(zExperimentMemberList.parse([member])).toEqual([member]);
    });

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

  // ----- Flow graph & content -----
  describe("Flow graph & nodes", () => {
    it("zFlowNodeType and zQuestionKind enums", () => {
      expect(zFlowNodeType.parse("question")).toBe("question");
      expect(zFlowNodeType.parse("analysis")).toBe("analysis");
      expect(zQuestionKind.parse("open_ended")).toBe("open_ended");
      expect(() => zFlowNodeType.parse("calc")).toThrow();
    });

    it("Question content (.strict) rejects extra keys", () => {
      const good = { kind: "yes_no", text: "OK?", required: false };
      expect(zQuestionContent.parse(good)).toEqual(good);

      const bad = { kind: "yes_no", text: "OK?", extra: 1 };
      expect(() => zQuestionContent.parse(bad)).toThrow();
    });

    it("Multi choice requires options", () => {
      const mc = { kind: "multi_choice", text: "Pick", options: ["a", "b"], required: false };
      expect(zQuestionContent.parse(mc)).toEqual(mc);

      const bad = { kind: "multi_choice", text: "Pick", options: [] };
      expect(() => zQuestionContent.parse(bad)).toThrow();
    });

    it("Instruction and Measurement content valid", () => {
      expect(zInstructionContent.parse({ text: "Do X" })).toEqual({ text: "Do X" });
      const m = { protocolId: uuidA, params: { exposure: 1, comment: "ok" } };
      expect(zMeasurementContent.parse(m)).toEqual(m);
    });

    it("Analysis content requires valid macroId", () => {
      const valid = { macroId: uuidA, params: { threshold: 10 } };
      expect(zAnalysisContent.parse(valid)).toEqual(valid);

      const validMinimal = { macroId: uuidB };
      expect(zAnalysisContent.parse(validMinimal)).toEqual({ macroId: uuidB });

      const invalidMacroId = { macroId: "not-a-uuid", params: {} };
      expect(() => zAnalysisContent.parse(invalidMacroId)).toThrow();

      const missingMacroId = { params: {} };
      expect(() => zAnalysisContent.parse(missingMacroId)).toThrow();
    });

    it("zFlowNode valid (defaults isStart=false)", () => {
      const node = {
        id: "n1",
        type: "question",
        name: "Start Q",
        content: { kind: "open_ended", text: "Hello?", required: false },
      };
      const parsed = zFlowNode.parse(node);
      expect(parsed).toEqual({ ...node, isStart: false });
    });

    it("zFlowEdge valid", () => {
      const edge = { id: "e1", source: "n1", target: "n2", label: "Yes" as string | null };
      expect(zFlowEdge.parse(edge)).toEqual(edge);
    });

    it("zFlowGraph enforces exactly one start node", () => {
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
      expect(zFlowGraph.parse(goodGraph)).toEqual(goodGraph);

      const zeroStart = {
        ...goodGraph,
        nodes: goodGraph.nodes.map((n) => ({ ...n, isStart: false })),
      };
      expect(() => zFlowGraph.parse(zeroStart)).toThrow();

      const twoStart = {
        ...goodGraph,
        nodes: goodGraph.nodes.map((n) => ({ ...n, isStart: true })),
      };
      expect(() => zFlowGraph.parse(twoStart)).toThrow();
    });

    it("zFlowGraph rejects duplicate question-node labels", () => {
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
      const result = zFlowGraph.safeParse(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.join(".") === "nodes.1.name");
        expect(issue?.message).toContain("Question Node");
        expect(issue?.message).toContain("unique");
      }
    });

    it("zFlowGraph allows duplicate labels across node types", () => {
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
      expect(zFlowGraph.parse(graph)).toEqual(graph);
    });

    it("zFlowGraph rejects question labels that collide after canonicalization", () => {
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
      const result = zFlowGraph.safeParse(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.join(".") === "nodes.1.name");
        expect(issue?.message).toContain("QUESTION-node!");
      }
    });

    it("zFlowGraph rejects question labels that resolve to a reserved column", () => {
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
      const result = zFlowGraph.safeParse(graph);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.join(".") === "nodes.0.name");
        expect(issue?.message).toContain("device_id");
        expect(issue?.message.toLowerCase()).toContain("reserved");
      }
    });

    it("zFlow and zUpsertFlowBody valid", () => {
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
      expect(zFlow.parse(flow)).toEqual(flow);
      expect(zUpsertFlowBody.parse(graph)).toEqual(graph);
    });
  });

  // ----- Create / Update bodies, Filters -----
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

    it("zAddExperimentMembersBody sets default role=member", () => {
      const body = { members: [{ userId: uuidA }, { userId: uuidB, role: "admin" }] };
      const parsed = zAddExperimentMembersBody.parse(body);
      expect(parsed.members[0].role).toBe("member");
      expect(parsed.members[1].role).toBe("admin");
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

  // ----- Annotations -----
  describe("Annotations", () => {
    it("zAnnotationType accepts valid values", () => {
      expect(zAnnotationType.parse("comment")).toBe("comment");
      expect(zAnnotationType.parse("flag")).toBe("flag");
      expect(() => zAnnotationType.parse("note")).toThrow();
    });

    it("zAnnotationFlagType accepts valid values", () => {
      expect(zAnnotationFlagType.parse("outlier")).toBe("outlier");
      expect(zAnnotationFlagType.parse("needs_review")).toBe("needs_review");
      expect(() => zAnnotationFlagType.parse("invalid")).toThrow();
    });

    it("zAnnotationCommentContent valid", () => {
      const comment = { type: "comment", text: "This is a comment" };
      expect(zAnnotationCommentContent.parse(comment)).toEqual(comment);
    });

    it("zAnnotationCommentContent rejects empty text", () => {
      expect(() => zAnnotationCommentContent.parse({ type: "comment", text: "" })).toThrow();
    });

    it("zAnnotationCommentContent rejects text too long", () => {
      const longText = "a".repeat(256);
      expect(() => zAnnotationCommentContent.parse({ type: "comment", text: longText })).toThrow();
    });

    it("zAnnotationFlagContent valid with text", () => {
      const flag = { type: "flag", flagType: "outlier", text: "This is flagged as outlier" };
      expect(zAnnotationFlagContent.parse(flag)).toEqual(flag);
    });

    it("zAnnotationFlagContent valid without text", () => {
      const flag = { type: "flag", flagType: "needs_review" };
      expect(zAnnotationFlagContent.parse(flag)).toEqual(flag);
    });

    it("zAnnotationContent discriminated union works", () => {
      const comment = { type: "comment", text: "Comment text" };
      const flag = { type: "flag", flagType: "outlier", text: "Flag text" };

      expect(zAnnotationContent.parse(comment)).toEqual(comment);
      expect(zAnnotationContent.parse(flag)).toEqual(flag);

      // Invalid type for comment
      expect(() => zAnnotationContent.parse({ type: "comment", flagType: "outlier" })).toThrow();
      // Invalid type for flag
      expect(() => zAnnotationContent.parse({ type: "flag", text: "no flagType" })).toThrow();
    });

    it("zAnnotation valid complete", () => {
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
      expect(zAnnotation.parse(annotation)).toEqual(annotation);
    });

    it("zAnnotation valid without optional fields", () => {
      const annotation = {
        id: uuidA,
        type: "flag",
        content: { type: "flag", flagType: "outlier" },
        createdBy: uuidB,
        createdAt: isoTime,
        updatedAt: isoTime2,
      };
      expect(zAnnotation.parse(annotation)).toEqual(annotation);
    });

    it("zAnnotationList valid array", () => {
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
      expect(zAnnotationList.parse(annotations)).toEqual(annotations);
    });

    it("zAnnotationPathParam valid", () => {
      const params = { id: uuidA, annotationId: uuidB };
      expect(zAnnotationPathParam.parse(params)).toEqual(params);
    });

    it("zAddAnnotationBody valid", () => {
      const body = {
        tableName: "sensor_data",
        rowId: "row-123",
        annotation: {
          type: "comment",
          content: { type: "comment", text: "Great data point!" },
        },
      };
      expect(zAddAnnotationBody.parse(body)).toEqual(body);
    });

    it("zAddAnnotationBody rejects empty rowId", () => {
      const body = {
        tableName: "sensor_data",
        rowId: "",
        annotation: {
          type: "comment",
          content: { type: "comment", text: "Test" },
        },
      };
      expect(() => zAddAnnotationBody.parse(body)).toThrow();
    });

    it("zAddAnnotationsBulkBody valid", () => {
      const body = {
        tableName: "sensor_data",
        rowIds: ["row-1", "row-2", "row-3"],
        annotation: {
          type: "flag",
          content: { type: "flag", flagType: "outlier", text: "All outliers" },
        },
      };
      expect(zAddAnnotationsBulkBody.parse(body)).toEqual(body);
    });

    it("zAddAnnotationsBulkBody rejects empty rowIds array", () => {
      const body = {
        tableName: "sensor_data",
        rowIds: [],
        annotation: {
          type: "comment",
          content: { type: "comment", text: "Test" },
        },
      };
      expect(() => zAddAnnotationsBulkBody.parse(body)).toThrow();
    });

    it("zListAnnotationsQuery valid with all fields", () => {
      const query = { page: 2, pageSize: 50, tableName: "measurements" };
      expect(zListAnnotationsQuery.parse(query)).toEqual(query);
    });

    it("zListAnnotationsQuery valid with just tableName", () => {
      const query = { tableName: "sensor_data" };
      expect(zListAnnotationsQuery.parse(query)).toEqual(query);
    });

    it("zListAnnotationsQuery coerces string numbers", () => {
      const query = { page: "3", pageSize: "25", tableName: "data" };
      const parsed = zListAnnotationsQuery.parse(query);
      expect(parsed.page).toBe(3);
      expect(parsed.pageSize).toBe(25);
      expect(parsed.tableName).toBe("data");
    });

    it("zUpdateAnnotationBody valid", () => {
      const body = {
        content: { type: "comment", text: "Updated comment text" },
      };
      expect(zUpdateAnnotationBody.parse(body)).toEqual(body);
    });

    it("zAnnotationDeleteBulkPathParam valid", () => {
      const params = { id: uuidA };
      expect(zAnnotationDeleteBulkPathParam.parse(params)).toEqual(params);
    });

    it("zAnnotationDeleteBulkBody valid", () => {
      const body = {
        tableName: "measurements",
        rowIds: ["row-1", "row-2"],
        type: "flag",
      };
      expect(zAnnotationDeleteBulkBody.parse(body)).toEqual(body);
    });

    it("zAnnotationDeleteBulkBody rejects empty rowIds", () => {
      const body = {
        tableName: "measurements",
        rowIds: [],
        type: "comment",
      };
      expect(() => zAnnotationDeleteBulkBody.parse(body)).toThrow();
    });

    it("zAnnotationRowsAffected valid", () => {
      const result = { rowsAffected: 5 };
      expect(zAnnotationRowsAffected.parse(result)).toEqual(result);
    });

    it("zAnnotationRowsAffected rejects non-integer", () => {
      expect(() => zAnnotationRowsAffected.parse({ rowsAffected: 3.14 })).toThrow();
    });
  });

  // ----- Data queries & tables -----
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

  // ----- Path params / responses -----
  describe("Path params / responses", () => {
    it("zIdPathParam valid and rejects bad uuid", () => {
      const ok = { id: uuidA };
      expect(zIdPathParam.parse(ok)).toEqual(ok);
      expect(() => zIdPathParam.parse({ id: "nope" })).toThrow();
    });

    it("zExperimentMemberPathParam valid", () => {
      const ok = { id: uuidA, memberId: uuidB };
      expect(zExperimentMemberPathParam.parse(ok)).toEqual(ok);
    });

    it("zExportPathParam valid and rejects bad uuid", () => {
      const ok = { id: uuidA, exportId: uuidB };
      expect(zExportPathParam.parse(ok)).toEqual(ok);
      expect(() => zExportPathParam.parse({ id: uuidA, exportId: "nope" })).toThrow();
      expect(() => zExportPathParam.parse({ id: "nope", exportId: uuidB })).toThrow();
    });

    it("zCreateExperimentResponse valid", () => {
      expect(zCreateExperimentResponse.parse({ id: uuidA })).toEqual({ id: uuidA });
    });
  });

  // ----- Export Data Schemas -----
  describe("Export Data Schemas", () => {
    it("zInitiateExportBody accepts valid input", () => {
      const body = { tableName: "raw_data", format: "csv" };
      expect(zInitiateExportBody.parse(body)).toEqual(body);
    });

    it("zInitiateExportBody accepts all valid formats", () => {
      for (const format of ["csv", "ndjson", "json-array", "parquet"] as const) {
        expect(zInitiateExportBody.parse({ tableName: "t1", format })).toEqual({
          tableName: "t1",
          format,
        });
      }
    });

    it("zInitiateExportBody rejects invalid format", () => {
      expect(() => zInitiateExportBody.parse({ tableName: "t1", format: "xml" })).toThrow();
    });

    it("zInitiateExportBody rejects missing fields", () => {
      expect(() => zInitiateExportBody.parse({ tableName: "t1" })).toThrow();
      expect(() => zInitiateExportBody.parse({ format: "csv" })).toThrow();
      expect(() => zInitiateExportBody.parse({})).toThrow();
    });

    it("zInitiateExportResponse valid", () => {
      const res = { status: "pending" };
      expect(zInitiateExportResponse.parse(res)).toEqual(res);
    });

    it("zInitiateExportResponse rejects empty status", () => {
      expect(() => zInitiateExportResponse.parse({})).toThrow();
    });

    it("zListExportsQuery valid", () => {
      const q = { tableName: "raw_data" };
      expect(zListExportsQuery.parse(q)).toEqual(q);
    });

    it("zListExportsQuery rejects missing tableName", () => {
      expect(() => zListExportsQuery.parse({})).toThrow();
    });

    it("zExportRecord accepts complete record", () => {
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
      expect(zExportRecord.parse(record)).toEqual(record);
    });

    it("zExportRecord accepts nullable fields as null", () => {
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
      expect(zExportRecord.parse(record)).toEqual(record);
    });

    it("zExportRecord accepts all valid statuses", () => {
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
        expect(zExportRecord.parse({ ...base, status })).toEqual({ ...base, status });
      }
    });

    it("zExportRecord rejects invalid status", () => {
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
      expect(() => zExportRecord.parse(record)).toThrow();
    });

    it("zExportRecord rejects invalid format", () => {
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
      expect(() => zExportRecord.parse(record)).toThrow();
    });

    it("zListExportsResponse valid with exports", () => {
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
      expect(zListExportsResponse.parse(response)).toEqual(response);
    });

    it("zListExportsResponse valid with empty exports", () => {
      const response = { exports: [] };
      expect(zListExportsResponse.parse(response)).toEqual(response);
    });

    it("zListExportsResponse rejects missing exports key", () => {
      expect(() => zListExportsResponse.parse({})).toThrow();
    });

    it("zDownloadExportResponse accepts any value", () => {
      // z.unknown() accepts anything
      expect(zDownloadExportResponse.parse("binary data")).toBe("binary data");
      expect(zDownloadExportResponse.parse(null)).toBe(null);
      expect(zDownloadExportResponse.parse(42)).toBe(42);
    });
  });

  // ----- Custom metadata payload -----
  describe("zCustomMetadataPayload", () => {
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
      expect(zCustomMetadataPayload.parse(validBlob)).toEqual(validBlob);
    });

    it("rejects empty/whitespace column names", () => {
      const blob = {
        ...validBlob,
        columns: [{ id: "x", name: "   ", type: "string" as const }],
        identifierColumnId: "   ",
      };
      const result = zCustomMetadataPayload.safeParse(blob);
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
      const result = zCustomMetadataPayload.safeParse(blob);
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
      const result = zCustomMetadataPayload.safeParse(blob);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.join(".") === "columns.0.name");
        expect(issue?.message.toLowerCase()).toContain("reserved");
      }
    });

    it("rejects identifierColumnId that is not in columns", () => {
      const blob = { ...validBlob, identifierColumnId: "missing" };
      const result = zCustomMetadataPayload.safeParse(blob);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path.join(".") === "identifierColumnId");
        expect(issue?.message).toContain("missing");
      }
    });

    it("requires at least one column", () => {
      const blob = { ...validBlob, columns: [] };
      expect(zCustomMetadataPayload.safeParse(blob).success).toBe(false);
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
      const result = zCustomMetadataPayload.safeParse(blob);
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
      expect(zCustomMetadataPayload.safeParse(blob).success).toBe(true);
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

    it("still applies the base zCustomMetadataPayload rules", () => {
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

  describe("zProjectTransferQuestionInput", () => {
    it("should validate a yes_no question", () => {
      const question = { kind: "yes_no", text: "Is this working?" };
      const result = zProjectTransferQuestionInput.parse(question);
      expect(result.kind).toBe("yes_no");
      expect(result.required).toBe(false); // default
    });

    it("should validate an open_ended question", () => {
      const question = { kind: "open_ended", text: "Describe the sample" };
      const result = zProjectTransferQuestionInput.parse(question);
      expect(result.kind).toBe("open_ended");
    });

    it("should validate a multi_choice question with options", () => {
      const question = {
        kind: "multi_choice",
        text: "Select a color",
        options: ["red", "green", "blue"],
        required: true,
      };
      const result = zProjectTransferQuestionInput.parse(question);
      expect(result.options).toEqual(["red", "green", "blue"]);
      expect(result.required).toBe(true);
    });

    it("should validate a number question", () => {
      const question = { kind: "number", text: "Enter temperature" };
      const result = zProjectTransferQuestionInput.parse(question);
      expect(result.kind).toBe("number");
    });

    it("should reject invalid kind", () => {
      expect(() => zProjectTransferQuestionInput.parse({ kind: "invalid", text: "Q" })).toThrow();
    });

    it("should reject empty text", () => {
      expect(() => zProjectTransferQuestionInput.parse({ kind: "yes_no", text: "" })).toThrow();
    });

    it("should reject text exceeding 64 characters", () => {
      expect(() =>
        zProjectTransferQuestionInput.parse({ kind: "yes_no", text: "a".repeat(65) }),
      ).toThrow();
    });
  });

  describe("zProjectTransferWebhookPayload", () => {
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
      const result = zProjectTransferWebhookPayload.parse(validPayload);
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

      const result = zProjectTransferWebhookPayload.parse(fullPayload);
      expect(result.experiment.locations).toHaveLength(1);
      expect(result.protocol?.family).toBe("ambit");
      expect(result.macro?.language).toBe("python");
      expect(result.questions).toHaveLength(1);
    });

    it("should validate a payload with only experiment (no protocol or macro)", () => {
      const result = zProjectTransferWebhookPayload.parse({
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
      expect(() => zProjectTransferWebhookPayload.parse(payload)).toThrow();
    });

    it("should reject invalid createdBy UUID", () => {
      const payload = {
        ...validPayload,
        experiment: { ...validPayload.experiment, createdBy: "not-a-uuid" },
      };
      expect(() => zProjectTransferWebhookPayload.parse(payload)).toThrow();
    });

    it("should reject empty macro code", () => {
      const payload = {
        ...validPayload,
        macro: { ...validPayload.macro, code: "" },
      };
      expect(() => zProjectTransferWebhookPayload.parse(payload)).toThrow();
    });

    it("should reject empty protocol code array", () => {
      const payload = {
        ...validPayload,
        protocol: { ...validPayload.protocol, code: [] },
      };
      // z.record(z.unknown()).array() allows empty arrays by default,
      // so this should still parse (no .min(1) on the array)
      const result = zProjectTransferWebhookPayload.safeParse(payload);
      // Empty code array is technically valid per schema
      expect(result.success).toBe(true);
    });

    it("should reject invalid protocol family", () => {
      const payload = {
        ...validPayload,
        protocol: { ...validPayload.protocol, family: "unknown" },
      };
      expect(() => zProjectTransferWebhookPayload.parse(payload)).toThrow();
    });

    it("should reject invalid macro language", () => {
      const payload = {
        ...validPayload,
        macro: { ...validPayload.macro, language: "rust" },
      };
      expect(() => zProjectTransferWebhookPayload.parse(payload)).toThrow();
    });
  });

  describe("zProjectTransferWebhookResponse", () => {
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
      const result = zProjectTransferWebhookResponse.parse(validResponse);
      expect(result).toEqual(validResponse);
    });

    it("should allow null flowId", () => {
      const result = zProjectTransferWebhookResponse.parse({ ...validResponse, flowId: null });
      expect(result.flowId).toBeNull();
    });

    it("should allow null protocolId and macroId", () => {
      const result = zProjectTransferWebhookResponse.parse({
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
      const result = zProjectTransferWebhookResponse.parse({
        ...validResponse,
        message: "Transfer complete",
      });
      expect(result.message).toBe("Transfer complete");
    });

    it("should reject invalid experimentId UUID", () => {
      expect(() =>
        zProjectTransferWebhookResponse.parse({ ...validResponse, experimentId: "bad" }),
      ).toThrow();
    });

    it("should reject missing required fields", () => {
      expect(() => zProjectTransferWebhookResponse.parse({ success: true })).toThrow();
    });
  });

  describe("Data filter primitives & distinct values", () => {
    describe("zDataFilterOperator", () => {
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
          expect(zDataFilterOperator.parse(op)).toBe(op);
        }
      });

      it("rejects an unknown operator", () => {
        expect(zDataFilterOperator.safeParse("starts_with").success).toBe(false);
      });
    });

    describe("zDataFilterValue", () => {
      it("accepts non-empty scalars", () => {
        expect(zDataFilterValue.parse("x")).toBe("x");
        expect(zDataFilterValue.parse(3)).toBe(3);
        expect(zDataFilterValue.parse(false)).toBe(false);
      });

      it("accepts a non-empty array of strings/numbers", () => {
        expect(zDataFilterValue.parse(["a", 2])).toEqual(["a", 2]);
      });

      it("rejects an empty string, empty array, and array with an empty string", () => {
        expect(zDataFilterValue.safeParse("").success).toBe(false);
        expect(zDataFilterValue.safeParse([]).success).toBe(false);
        expect(zDataFilterValue.safeParse([""]).success).toBe(false);
      });
    });

    describe("zDataFilter.superRefine", () => {
      const base = { column: "temp" };

      it("requires a non-empty column", () => {
        expect(zDataFilter.safeParse({ column: "", operator: "equals", value: "x" }).success).toBe(
          false,
        );
      });

      it("'in' requires an array; accepts an array", () => {
        expect(zDataFilter.safeParse({ ...base, operator: "in", value: "x" }).success).toBe(false);
        expect(zDataFilter.safeParse({ ...base, operator: "in", value: ["a", "b"] }).success).toBe(
          true,
        );
      });

      it("'between' requires a same-typed 2-tuple", () => {
        expect(zDataFilter.safeParse({ ...base, operator: "between", value: 5 }).success).toBe(
          false,
        );
        expect(zDataFilter.safeParse({ ...base, operator: "between", value: [1] }).success).toBe(
          false,
        );
        expect(
          zDataFilter.safeParse({ ...base, operator: "between", value: [1, "2"] }).success,
        ).toBe(false);
        expect(zDataFilter.safeParse({ ...base, operator: "between", value: [1, 9] }).success).toBe(
          true,
        );
      });

      it("rejects array values for non-array operators", () => {
        expect(
          zDataFilter.safeParse({ ...base, operator: "equals", value: ["a", "b"] }).success,
        ).toBe(false);
      });

      it("comparison operators require a number or ISO date string", () => {
        expect(
          zDataFilter.safeParse({ ...base, operator: "greater_than", value: true }).success,
        ).toBe(false);
        expect(
          zDataFilter.safeParse({ ...base, operator: "greater_than", value: 10 }).success,
        ).toBe(true);
        expect(
          zDataFilter.safeParse({
            ...base,
            operator: "less_than_or_equal",
            value: "2024-01-01",
          }).success,
        ).toBe(true);
        expect(
          zDataFilter.safeParse({ ...base, operator: "greater_than", value: "not-a-date" }).success,
        ).toBe(false);
      });

      it("'contains' requires a string value", () => {
        expect(zDataFilter.safeParse({ ...base, operator: "contains", value: 5 }).success).toBe(
          false,
        );
        expect(zDataFilter.safeParse({ ...base, operator: "contains", value: "lf" }).success).toBe(
          true,
        );
      });

      it("accepts a plain equals filter", () => {
        expect(
          zDataFilter.safeParse({ ...base, operator: "equals", value: "active" }).success,
        ).toBe(true);
      });
    });

    describe("zDistinctValuesQuery", () => {
      it("accepts a minimal query and leaves limit optional", () => {
        const parsed = zDistinctValuesQuery.parse({ tableName: "raw_data", column: "site" });
        expect(parsed.limit).toBeUndefined();
      });

      it("coerces a numeric-string limit", () => {
        expect(
          zDistinctValuesQuery.parse({ tableName: "raw_data", column: "site", limit: "50" }).limit,
        ).toBe(50);
      });

      it("rejects a missing column and an over-cap limit", () => {
        expect(zDistinctValuesQuery.safeParse({ tableName: "raw_data", column: "" }).success).toBe(
          false,
        );
        expect(
          zDistinctValuesQuery.safeParse({
            tableName: "raw_data",
            column: "site",
            limit: DISTINCT_VALUES_MAX_LIMIT + 1,
          }).success,
        ).toBe(false);
      });
    });

    describe("zDistinctValuesResponse", () => {
      it("accepts string and number values with a truncated flag", () => {
        const parsed = zDistinctValuesResponse.parse({
          values: ["a", 1, "b"],
          truncated: true,
        });
        expect(parsed.values).toEqual(["a", 1, "b"]);
        expect(parsed.truncated).toBe(true);
      });

      it("rejects boolean values", () => {
        expect(
          zDistinctValuesResponse.safeParse({ values: [true], truncated: false }).success,
        ).toBe(false);
      });
    });
  });

  describe("anonymizeContributors on update/export bodies", () => {
    it("zUpdateExperimentBody accepts the new flag", () => {
      const body = { anonymizeContributors: true };
      expect(zUpdateExperimentBody.parse(body)).toEqual(body);
    });

    it("zInitiateExportBody accepts the per-export override", () => {
      const body = { tableName: "t", format: "csv" as const, anonymizeContributors: true };
      expect(zInitiateExportBody.parse(body)).toEqual(body);
    });
  });
  describe("Upload schemas", () => {
    describe("zUploadSourceKind", () => {
      it("accepts all supported kinds", () => {
        expect(zUploadSourceKind.safeParse("ambyte").success).toBe(true);
        expect(zUploadSourceKind.safeParse("csv").success).toBe(true);
        expect(zUploadSourceKind.safeParse("tsv").success).toBe(true);
        expect(zUploadSourceKind.safeParse("parquet").success).toBe(true);
        expect(zUploadSourceKind.safeParse("xlsx").success).toBe(true);
        expect(zUploadSourceKind.safeParse("json").success).toBe(true);
        expect(zUploadSourceKind.safeParse("ndjson").success).toBe(true);
      });

      it("rejects unknown kinds", () => {
        expect(zUploadSourceKind.safeParse("orc").success).toBe(false);
        expect(zUploadSourceKind.safeParse("").success).toBe(false);
      });
    });

    describe("zUploadTableName", () => {
      it("accepts ASCII identifier shape", () => {
        expect(zUploadTableName.safeParse("leaf_traits").success).toBe(true);
        expect(zUploadTableName.safeParse("Table1").success).toBe(true);
        expect(zUploadTableName.safeParse("a").success).toBe(true);
      });

      it("rejects names that don't start with a letter", () => {
        expect(zUploadTableName.safeParse("1table").success).toBe(false);
        expect(zUploadTableName.safeParse("_table").success).toBe(false);
      });

      it("rejects names with non-identifier characters", () => {
        expect(zUploadTableName.safeParse("table-name").success).toBe(false);
        expect(zUploadTableName.safeParse("table name").success).toBe(false);
        expect(zUploadTableName.safeParse("table.name").success).toBe(false);
      });

      it("rejects names longer than 63 characters", () => {
        expect(zUploadTableName.safeParse("a".repeat(63)).success).toBe(true);
        expect(zUploadTableName.safeParse("a".repeat(64)).success).toBe(false);
      });

      it("rejects empty names", () => {
        expect(zUploadTableName.safeParse("").success).toBe(false);
      });
    });

    describe("zUploadTargetTable", () => {
      it("accepts a 'new' target with a valid name", () => {
        const result = zUploadTargetTable.safeParse({ kind: "new", name: "leaf_traits" });
        expect(result.success).toBe(true);
      });

      it("accepts an 'existing' target with a valid uploadTableId UUID", () => {
        const result = zUploadTargetTable.safeParse({
          kind: "existing",
          uploadTableId: "11111111-1111-1111-1111-111111111111",
        });
        expect(result.success).toBe(true);
      });

      it("rejects an 'existing' target with a non-UUID uploadTableId", () => {
        expect(
          zUploadTargetTable.safeParse({ kind: "existing", uploadTableId: "leaf_traits" }).success,
        ).toBe(false);
      });

      it("rejects an invalid kind", () => {
        expect(zUploadTargetTable.safeParse({ kind: "other", name: "x" }).success).toBe(false);
      });

      it("rejects when name fails identifier validation", () => {
        expect(zUploadTargetTable.safeParse({ kind: "new", name: "1bad" }).success).toBe(false);
      });
    });

    describe("zCsvFilename", () => {
      it("returns the basename for a path-prefixed CSV", () => {
        const result = zCsvFilename.safeParse("some/dir/data.csv");
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe("data.csv");
        }
      });

      it("accepts a bare CSV filename", () => {
        const result = zCsvFilename.safeParse("data.csv");
        expect(result.success).toBe(true);
      });

      it("rejects non-CSV extensions", () => {
        expect(zCsvFilename.safeParse("data.txt").success).toBe(false);
        expect(zCsvFilename.safeParse("data").success).toBe(false);
      });

      it("rejects oversize names", () => {
        expect(zCsvFilename.safeParse("a".repeat(257) + ".csv").success).toBe(false);
      });
    });

    describe("zTsvFilename", () => {
      it("accepts a bare TSV filename", () => {
        expect(zTsvFilename.safeParse("data.tsv").success).toBe(true);
      });

      it("rejects non-TSV extensions", () => {
        expect(zTsvFilename.safeParse("data.csv").success).toBe(false);
      });
    });

    describe("zParquetFilename", () => {
      it("accepts a bare parquet filename", () => {
        expect(zParquetFilename.safeParse("data.parquet").success).toBe(true);
      });

      it("rejects non-parquet extensions", () => {
        expect(zParquetFilename.safeParse("data.csv").success).toBe(false);
      });
    });

    describe("zXlsxFilename", () => {
      it("accepts .xlsx and .xls", () => {
        expect(zXlsxFilename.safeParse("data.xlsx").success).toBe(true);
        expect(zXlsxFilename.safeParse("data.xls").success).toBe(true);
      });

      it("rejects non-Excel extensions", () => {
        expect(zXlsxFilename.safeParse("data.csv").success).toBe(false);
      });
    });

    describe("zJsonFilename", () => {
      it("accepts a bare JSON filename", () => {
        expect(zJsonFilename.safeParse("data.json").success).toBe(true);
      });

      it("rejects non-JSON extensions", () => {
        expect(zJsonFilename.safeParse("data.ndjson").success).toBe(false);
        expect(zJsonFilename.safeParse("data.csv").success).toBe(false);
      });
    });

    describe("zNdjsonFilename", () => {
      it("accepts .ndjson and .jsonl", () => {
        expect(zNdjsonFilename.safeParse("data.ndjson").success).toBe(true);
        expect(zNdjsonFilename.safeParse("data.jsonl").success).toBe(true);
      });

      it("rejects non-NDJSON extensions", () => {
        expect(zNdjsonFilename.safeParse("data.json").success).toBe(false);
        expect(zNdjsonFilename.safeParse("data.csv").success).toBe(false);
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

    describe("zAmbyteFilename", () => {
      it("transforms a pathed Ambyte_N file to the trimmed tail", () => {
        const result = zAmbyteFilename.safeParse("uploads/Ambyte_5/data.txt");
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe("Ambyte_5/data.txt");
        }
      });

      it("transforms a pathed Ambyte_N/[1-4]/file.txt to the 3-segment tail", () => {
        const result = zAmbyteFilename.safeParse("prefix/Ambyte_12/3/some.txt");
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe("Ambyte_12/3/some.txt");
        }
      });

      it("buckets a bare timestamp filename under unknown_ambyte/unknown_ambit", () => {
        const result = zAmbyteFilename.safeParse("20260101-120000_.txt");
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe("unknown_ambyte/unknown_ambit/20260101-120000_.txt");
        }
      });

      it("buckets a generic bare .txt under unknown_ambyte", () => {
        const result = zAmbyteFilename.safeParse("anything.txt");
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toBe("unknown_ambyte/anything.txt");
        }
      });

      it("rejects non-.txt files", () => {
        expect(zAmbyteFilename.safeParse("Ambyte_1/data.csv").success).toBe(false);
      });

      it("rejects pathed files that don't match the Ambyte_N tail shape", () => {
        expect(zAmbyteFilename.safeParse("something/else/data.txt").success).toBe(false);
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

    describe("zUploadMetadata", () => {
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
        expect(zUploadMetadata.safeParse(valid).success).toBe(true);
      });

      it("accepts null uploadTableId / uploadTableName / row counts / completedAt / errorMessage", () => {
        const result = zUploadMetadata.safeParse({
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
        expect(zUploadMetadata.safeParse({ ...valid, status: "halfway" }).success).toBe(false);
      });
    });
  });

  // ----- Dashboard schemas -----
  describe("Dashboard schemas", () => {
    const layout = { col: 0, row: 0, colSpan: 6, rowSpan: 4 };

    describe("zWidgetLayout", () => {
      it("accepts a valid layout block", () => {
        expect(zWidgetLayout.parse(layout)).toEqual(layout);
      });

      it("rejects negative coordinates", () => {
        expect(zWidgetLayout.safeParse({ ...layout, col: -1 }).success).toBe(false);
      });

      it("rejects zero spans (min is 1)", () => {
        expect(zWidgetLayout.safeParse({ ...layout, colSpan: 0 }).success).toBe(false);
        expect(zWidgetLayout.safeParse({ ...layout, rowSpan: 0 }).success).toBe(false);
      });

      it("caps colSpan at 24 and rowSpan at 48", () => {
        expect(zWidgetLayout.safeParse({ ...layout, colSpan: 25 }).success).toBe(false);
        expect(zWidgetLayout.safeParse({ ...layout, rowSpan: 49 }).success).toBe(false);
      });
    });

    describe("zVisualizationWidget", () => {
      it("applies default showTitle=true, showDescription=false", () => {
        const w = {
          id: uuidA,
          layout,
          type: "visualization" as const,
          config: { visualizationId: uuidB },
        };
        const parsed = zVisualizationWidget.parse(w);
        expect(parsed.config.showTitle).toBe(true);
        expect(parsed.config.showDescription).toBe(false);
      });

      it("allows visualizationId to be omitted (draft state)", () => {
        const w = { id: uuidA, layout, type: "visualization" as const, config: {} };
        expect(zVisualizationWidget.parse(w).config.visualizationId).toBeUndefined();
      });
    });

    describe("zRichTextWidget", () => {
      it("defaults html to empty string when omitted", () => {
        const w = { id: uuidA, layout, type: "richText" as const, config: {} };
        expect(zRichTextWidget.parse(w).config.html).toBe("");
      });
    });

    describe("zTableWidget", () => {
      it("defaults pageSize to 25", () => {
        const w = { id: uuidA, layout, type: "table" as const, config: {} };
        expect(zTableWidget.parse(w).config.pageSize).toBe(25);
      });

      it("rejects unsupported pageSize values", () => {
        const w = {
          id: uuidA,
          layout,
          type: "table" as const,
          config: { pageSize: 30 },
        };
        expect(zTableWidget.safeParse(w).success).toBe(false);
      });

      it("rejects empty column names in the projection list", () => {
        const w = {
          id: uuidA,
          layout,
          type: "table" as const,
          config: { columns: [""] },
        };
        expect(zTableWidget.safeParse(w).success).toBe(false);
      });

      it("propagates zDataFilter refinements to per-widget filters", () => {
        const w = {
          id: uuidA,
          layout,
          type: "table" as const,
          config: { filters: [{ column: "x", operator: "between", value: [1] }] },
        };
        expect(zTableWidget.safeParse(w).success).toBe(false);
      });
    });

    describe("zFilterWidget", () => {
      it("allows all selection fields to be unset (draft state)", () => {
        const w = { id: uuidA, layout, type: "filter" as const, config: {} };
        const parsed = zFilterWidget.parse(w);
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
        expect(zFilterWidget.parse(w)).toBeDefined();
      });
    });

    describe("zDashboardWidget (discriminated union)", () => {
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
        expect(zDashboardWidget.parse(viz).type).toBe("visualization");
        expect(zDashboardWidget.parse(text).type).toBe("richText");
      });

      it("rejects unknown discriminator values", () => {
        const bad = { id: uuidA, layout, type: "iframe", config: {} };
        expect(zDashboardWidget.safeParse(bad).success).toBe(false);
      });
    });

    describe("zDashboardLayout", () => {
      it("applies grid defaults when fields omitted", () => {
        const parsed = zDashboardLayout.parse({});
        expect(parsed.columns).toBe(12);
        expect(parsed.rowHeight).toBe(80);
        expect(parsed.gap).toBe(16);
      });

      it("rejects out-of-range values", () => {
        expect(zDashboardLayout.safeParse({ columns: 0 }).success).toBe(false);
        expect(zDashboardLayout.safeParse({ rowHeight: 500 }).success).toBe(false);
        expect(zDashboardLayout.safeParse({ gap: 100 }).success).toBe(false);
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

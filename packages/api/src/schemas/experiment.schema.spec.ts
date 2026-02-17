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
  // Protocol associations
  zExperimentProtocolDetails,
  zExperimentProtocol,
  zExperimentProtocolList,
  zExperimentProtocolPathParam,
  zAddExperimentProtocolsBody,
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

  // ----- Protocol associations -----
  describe("Protocol associations", () => {
    it("zExperimentProtocolDetails valid", () => {
      const det = { id: uuidA, name: "Fv/FM", family: "multispeq", createdBy: uuidB };
      expect(zExperimentProtocolDetails.parse(det)).toEqual(det);
    });

    it("zExperimentProtocol valid", () => {
      const assoc = {
        experimentId: uuidA,
        order: 2,
        addedAt: isoTime,
        protocol: { id: uuidB, name: "AMB", family: "ambit", createdBy: uuidC },
      };
      expect(zExperimentProtocol.parse(assoc)).toEqual(assoc);
    });

    it("zExperimentProtocolList valid", () => {
      const assoc = {
        experimentId: uuidA,
        order: 1,
        addedAt: isoTime,
        protocol: { id: uuidB, name: "P1", family: "multispeq", createdBy: uuidC },
      };
      expect(zExperimentProtocolList.parse([assoc])).toEqual([assoc]);
    });

    it("zExperimentProtocolPathParam valid", () => {
      const params = { id: uuidA, protocolId: uuidB };
      expect(zExperimentProtocolPathParam.parse(params)).toEqual(params);
    });

    it("zAddExperimentProtocolsBody valid", () => {
      const body = { protocols: [{ protocolId: uuidA, order: 1 }, { protocolId: uuidB }] };
      expect(zAddExperimentProtocolsBody.parse(body)).toEqual(body);
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

    it("zCreateExperimentBody full with members/protocols", () => {
      const body = {
        name: "Big Exp",
        description: "optional",
        status: "active",
        visibility: "public",
        members: [{ userId: uuidA, role: "admin" }, { userId: uuidB }],
        protocols: [{ protocolId: uuidA, order: 1 }, { protocolId: uuidB }],
      };
      const parsed = zCreateExperimentBody.parse(body);
      // role default on second member is handled at consumer side (schema default is for AddMembers body)
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
      for (const format of ["csv", "json", "parquet"] as const) {
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
      const res = { exportId: uuidA, status: "pending" };
      expect(zInitiateExportResponse.parse(res)).toEqual(res);
    });

    it("zInitiateExportResponse rejects bad uuid", () => {
      expect(() =>
        zInitiateExportResponse.parse({ exportId: "nope", status: "pending" }),
      ).toThrow();
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
        format: "json",
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
      for (const status of ["pending", "running", "completed", "failed"] as const) {
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
});

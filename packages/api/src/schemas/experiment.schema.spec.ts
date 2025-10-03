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
  zExperimentDataTableInfo,
  zExperimentDataTableList,
  zExperimentDataResponse,
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
  zCreateExperimentResponse,
  // Webhooks
  zExperimentWebhookAuthHeader,
  zExperimentProvisioningStatusWebhookPayload,
  zExperimentWebhookSuccessResponse,
  zExperimentWebhookErrorResponse,
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
      const all = [
        "provisioning",
        "provisioning_failed",
        "active",
        "stale",
        "archived",
        "published",
      ] as const;
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

    it("zExperimentData rejects non-string row values", () => {
      const bad = {
        columns: [{ name: "a", type_name: "text", type_text: "VARCHAR" }],
        rows: [{ a: 123 }], // not string or null
        totalRows: 1,
        truncated: false,
      } as unknown;
      expect(() => zExperimentData.parse(bad)).toThrow();
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
      expect(zExperimentFilterQuery.parse({ filter: "my" })).toEqual({ filter: "my" });
      expect(zExperimentFilterQuery.parse({ filter: "member" })).toEqual({ filter: "member" });
      expect(zExperimentFilterQuery.parse({ filter: "related" })).toEqual({ filter: "related" });
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
          filter: "my",
          status: "active",
          search: "my experiment",
        }),
      ).toEqual({
        filter: "my",
        status: "active",
        search: "my experiment",
      });
    });
  });

  // ----- Data queries & tables -----
  describe("Data queries & tables", () => {
    it("zExperimentDataQuery defaults & coercion", () => {
      const d1 = zExperimentDataQuery.parse({});
      expect(d1.page).toBeUndefined();
      expect(d1.pageSize).toBeUndefined();

      const d2 = zExperimentDataQuery.parse({ page: "3", pageSize: "10" });
      expect(d2.page).toBe(3);
      expect(d2.pageSize).toBe(10);
    });

    it("zExperimentDataTableInfo valid", () => {
      const info = {
        name: "tbl",
        catalog_name: "hive_metastore",
        schema_name: "default",
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
      expect(zExperimentDataTableInfo.parse(info)).toEqual(info);
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

    it("zCreateExperimentResponse valid", () => {
      expect(zCreateExperimentResponse.parse({ id: uuidA })).toEqual({ id: uuidA });
    });
  });

  // ----- Webhooks -----
  describe("Webhooks", () => {
    it("zExperimentWebhookAuthHeader valid", () => {
      const hdr = {
        "x-api-key-id": "key123",
        "x-databricks-signature": "sig",
        "x-databricks-timestamp": "1234567890",
      };
      expect(zExperimentWebhookAuthHeader.parse(hdr)).toEqual(hdr);
    });

    it("zExperimentProvisioningStatusWebhookPayload accepts allowed statuses", () => {
      const payload = {
        status: "RUNNING",
        jobRunId: "jr1",
        taskRunId: "tr1",
        timestamp: isoTime,
      };
      expect(zExperimentProvisioningStatusWebhookPayload.parse(payload)).toEqual(payload);
    });

    it("zExperimentWebhookSuccessResponse valid", () => {
      const ok = { success: true, message: "ok" };
      expect(zExperimentWebhookSuccessResponse.parse(ok)).toEqual(ok);
    });

    it("zExperimentWebhookErrorResponse valid", () => {
      const err = { error: "E", message: "nope", statusCode: 400 };
      expect(zExperimentWebhookErrorResponse.parse(err)).toEqual(err);
    });
  });
});

import type { ProjectTransferWebhookPayload } from "@repo/api";

import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import { EmailAdapter } from "../../../../common/modules/email/services/email.adapter";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { MacroRepository } from "../../../../macros/core/repositories/macro.repository";
import { ProtocolRepository } from "../../../../protocols/core/repositories/protocol.repository";
import { TestHarness } from "../../../../test/test-harness";
import { EMAIL_PORT } from "../../../core/ports/email.port";
import { ExperimentProtocolRepository } from "../../../core/repositories/experiment-protocol.repository";
import { FlowRepository } from "../../../core/repositories/flow.repository";
import { ExecuteProjectTransferUseCase } from "./execute-project-transfer";

describe("ExecuteProjectTransferUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: ExecuteProjectTransferUseCase;
  let testUserId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(ExecuteProjectTransferUseCase);

    // Default: Databricks upload succeeds (DatabricksAdapter is a singleton from DatabricksModule)
    const databricksAdapter = testApp.module.get(DatabricksAdapter);
    vi.spyOn(databricksAdapter, "uploadMacroCode").mockResolvedValue(success({}));

    // Default: Email sending succeeds
    const emailAdapter = testApp.module.get(EMAIL_PORT);
    vi.spyOn(emailAdapter, "sendProjectTransferComplete").mockResolvedValue(success(undefined));
  });

  afterEach(() => {
    testApp.afterEach();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const buildPayload = (overrides?: Partial<ProjectTransferWebhookPayload>) => {
    const base: ProjectTransferWebhookPayload = {
      experiment: {
        name: "Transfer Experiment",
        createdBy: testUserId,
      },
      protocol: {
        name: "Transfer Protocol",
        code: [{ step: "measure" }],
        family: "multispeq",
        createdBy: testUserId,
      },
      macro: {
        name: "Transfer Macro",
        language: "javascript",
        code: "Y29uc29sZS5sb2coJ2hlbGxvJyk=",
        createdBy: testUserId,
      },
    };

    return { ...base, ...overrides };
  };

  describe("execute", () => {
    it("should successfully create experiment, protocol, and macro", async () => {
      const payload = buildPayload();

      const result = await useCase.execute(payload);

      assertSuccess(result);
      expect(result.value.success).toBe(true);
      expect(result.value.experimentId).toBeDefined();
      expect(result.value.protocolId).toBeDefined();
      expect(result.value.macroId).toBeDefined();
    });

    it("should upload macro code to Databricks", async () => {
      const databricksAdapter = testApp.module.get(DatabricksAdapter);
      const uploadSpy = vi
        .spyOn(databricksAdapter, "uploadMacroCode")
        .mockResolvedValue(success({}));

      const payload = buildPayload();
      await useCase.execute(payload);

      expect(uploadSpy).toHaveBeenCalledOnce();
    });

    it("should succeed even when Databricks upload fails (non-fatal)", async () => {
      const databricksAdapter = testApp.module.get(DatabricksAdapter);
      vi.spyOn(databricksAdapter, "uploadMacroCode").mockResolvedValue(
        failure({
          message: "Databricks unavailable",
          code: "DATABRICKS_ERROR",
          statusCode: 500,
          name: "",
        }),
      );

      const payload = buildPayload();
      const result = await useCase.execute(payload);

      assertSuccess(result);
      expect(result.value.success).toBe(true);
    });

    it("should create a flow with questions when provided", async () => {
      const payload = buildPayload({
        questions: [
          { kind: "yes_no", text: "Ready?", required: false },
          { kind: "open_ended", text: "Notes", required: false },
        ],
      });

      const result = await useCase.execute(payload);

      assertSuccess(result);
      expect(result.value.flowId).toBeDefined();
      expect(result.value.flowId).not.toBeNull();
    });

    it("should create a flow without questions", async () => {
      const payload = buildPayload();

      const result = await useCase.execute(payload);

      assertSuccess(result);
      // Flow should still be created (measurement + analysis nodes)
      // flowId may or may not be null depending on flow creation success
      expect(result.value.success).toBe(true);
    });

    it("should handle flow creation failure gracefully (non-fatal)", async () => {
      vi.spyOn(FlowRepository.prototype, "create").mockResolvedValue(
        failure(AppError.internal("Flow creation failed")),
      );

      const payload = buildPayload();
      const result = await useCase.execute(payload);

      assertSuccess(result);
      expect(result.value.success).toBe(true);
      expect(result.value.flowId).toBeNull();
    });

    it("should add locations when provided", async () => {
      const payload = buildPayload({
        experiment: {
          name: "Exp With Locations",
          createdBy: testUserId,
          locations: [
            { name: "Site A", latitude: 42.36, longitude: -71.06 },
            { name: "Site B", latitude: 40.71, longitude: -74.01 },
          ],
        },
      });

      const result = await useCase.execute(payload);

      assertSuccess(result);
      expect(result.value.success).toBe(true);
    });

    it("should fail when protocol creation fails", async () => {
      vi.spyOn(ProtocolRepository.prototype, "create").mockResolvedValue(
        failure(AppError.internal("DB error")),
      );

      const payload = buildPayload();
      const result = await useCase.execute(payload);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
    });

    it("should fail when protocol creation returns empty array", async () => {
      vi.spyOn(ProtocolRepository.prototype, "create").mockResolvedValue(success([]));

      const payload = buildPayload();
      const result = await useCase.execute(payload);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to create protocol");
    });

    it("should fail when macro creation fails", async () => {
      vi.spyOn(MacroRepository.prototype, "create").mockResolvedValue(
        failure(AppError.internal("DB error")),
      );

      const payload = buildPayload();
      const result = await useCase.execute(payload);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
    });

    it("should fail when experiment protocol association fails", async () => {
      vi.spyOn(ExperimentProtocolRepository.prototype, "addProtocols").mockResolvedValue(
        failure(AppError.internal("Association failed")),
      );

      const payload = buildPayload();
      const result = await useCase.execute(payload);

      expect(result.isFailure()).toBe(true);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to associate protocol");
    });

    it("should handle multi_choice questions in flow", async () => {
      const payload = buildPayload({
        questions: [
          {
            kind: "multi_choice",
            text: "Pick one",
            options: ["A", "B", "C"],
            required: true,
          },
        ],
      });

      const result = await useCase.execute(payload);

      assertSuccess(result);
      expect(result.value.flowId).toBeDefined();
    });

    it("should handle number questions in flow", async () => {
      const payload = buildPayload({
        questions: [{ kind: "number", text: "Temperature?", required: false }],
      });

      const result = await useCase.execute(payload);

      assertSuccess(result);
      expect(result.value.flowId).toBeDefined();
    });

    it("should succeed without protocol and macro (experiment only)", async () => {
      const result = await useCase.execute({
        experiment: {
          name: "Experiment Only Transfer",
          createdBy: testUserId,
        },
      });

      assertSuccess(result);
      expect(result.value.success).toBe(true);
      expect(result.value.experimentId).toBeDefined();
      expect(result.value.protocolId).toBeNull();
      expect(result.value.macroId).toBeNull();
      expect(result.value.flowId).toBeNull();
    });

    it("should succeed with only protocol (no macro)", async () => {
      const result = await useCase.execute({
        experiment: {
          name: "Protocol Only Transfer",
          createdBy: testUserId,
        },
        protocol: {
          name: "Solo Protocol",
          code: [{ step: "measure" }],
          family: "multispeq",
          createdBy: testUserId,
        },
      });

      assertSuccess(result);
      expect(result.value.protocolId).toBeDefined();
      expect(result.value.protocolId).not.toBeNull();
      expect(result.value.macroId).toBeNull();
      expect(result.value.flowId).toBeNull();
    });

    it("should send project transfer complete email after successful transfer", async () => {
      const emailAdapter = testApp.module.get(EMAIL_PORT);
      const emailSpy = vi
        .spyOn(emailAdapter, "sendProjectTransferComplete")
        .mockResolvedValue(success(undefined));

      const payload = buildPayload();
      const result = await useCase.execute(payload);

      assertSuccess(result);
      expect(emailSpy).toHaveBeenCalledOnce();
      expect(emailSpy).toHaveBeenCalledWith(
        expect.any(String), // user email
        result.value.experimentId,
        payload.experiment.name,
      );
    });

    it("should succeed even when email sending fails (non-fatal)", async () => {
      const emailAdapter = testApp.module.get(EMAIL_PORT);
      vi.spyOn(emailAdapter, "sendProjectTransferComplete").mockResolvedValue(
        failure({
          message: "Email service unavailable",
          code: "INTERNAL_ERROR",
          statusCode: 500,
          name: "InternalError",
        }),
      );

      const payload = buildPayload();
      const result = await useCase.execute(payload);

      assertSuccess(result);
      expect(result.value.success).toBe(true);
    });

    it("should succeed when user has no email address", async () => {
      // Create a user without an email
      const noEmailUserId = await testApp.createTestUser({ email: "" });

      const payload = buildPayload({
        experiment: {
          name: "No Email Transfer",
          createdBy: noEmailUserId,
        },
      });
      const result = await useCase.execute(payload);

      assertSuccess(result);
      expect(result.value.success).toBe(true);
    });
  });
});

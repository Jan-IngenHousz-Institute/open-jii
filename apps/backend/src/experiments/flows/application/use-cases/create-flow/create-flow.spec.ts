import { TestHarness } from "@/test/test-harness";

import { assertSuccess } from "../../../../../common/utils/fp-utils";
import { FlowRepository } from "../../../core/repositories/flow.repository";
import { CreateFlowUseCase } from "./create-flow";

describe("CreateFlowUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: CreateFlowUseCase;
  let flowRepository: FlowRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(CreateFlowUseCase);
    flowRepository = testApp.module.get(FlowRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("execute", () => {
    it("should create a flow successfully", async () => {
      const flowData = {
        name: "Test Flow",
        description: "A test flow for validation",
        version: 1,
        isActive: true,
      };

      const result = await useCase.execute(flowData, testUserId);

      assertSuccess(result);
      expect(result.value).toMatchObject({
        name: flowData.name,
        description: flowData.description,
        version: 1,
        isActive: true,
        createdBy: testUserId,
      });
      expect(result.value.id).toBeDefined();

      // Verify flow was created in database
      const findResult = await flowRepository.findOne(result.value.id);
      assertSuccess(findResult);
      expect(findResult.value).toMatchObject({
        name: flowData.name,
        createdBy: testUserId,
      });
    });

    it("should create a flow with minimal data", async () => {
      const flowData = {
        name: "Minimal Flow",
      };

      const result = await useCase.execute(flowData, testUserId);

      assertSuccess(result);
      expect(result.value).toMatchObject({
        name: flowData.name,
        version: 1,
        isActive: true,
        createdBy: testUserId,
      });
    });
  });
});

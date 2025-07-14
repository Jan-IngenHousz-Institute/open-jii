import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { ExperimentProtocolRepository } from "./experiment-protocol.repository";

describe("ExperimentProtocolRepository", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentProtocolRepository;
  let testUserId: string;
  let experimentId: string;
  let protocolId1: string;
  let protocolId2: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    repository = testApp.module.get(ExperimentProtocolRepository);
    // Create experiment and two protocols
    const { experiment } = await testApp.createExperiment({
      name: "Experiment for Protocols",
      userId: testUserId,
    });
    experimentId = experiment.id;
    protocolId1 = (await testApp.createProtocol({ name: "Protocol 1", createdBy: testUserId })).id;
    protocolId2 = (await testApp.createProtocol({ name: "Protocol 2", createdBy: testUserId })).id;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("addProtocols", () => {
    it("should add multiple protocols to an experiment with order", async () => {
      const result = await repository.addProtocols(experimentId, [
        { protocolId: protocolId1, order: 0 },
        { protocolId: protocolId2, order: 1 },
      ]);
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const protocols = result.value;
      expect(protocols.length).toBe(2);
      expect(protocols[0]).toMatchObject({ order: 0 });
      expect(protocols[0].protocol.id).toBe(protocolId1);
      expect(protocols[1]).toMatchObject({ order: 1 });
      expect(protocols[1].protocol.id).toBe(protocolId2);
    });

    it("should return empty array and not fail if protocols array is empty", async () => {
      const result = await repository.addProtocols(experimentId, []);
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual([]);
    });
  });

  describe("listProtocols", () => {
    it("should return all protocols for an experiment", async () => {
      await repository.addProtocols(experimentId, [
        { protocolId: protocolId1, order: 0 },
        { protocolId: protocolId2, order: 1 },
      ]);
      const result = await repository.listProtocols(experimentId);
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const protocols = result.value;
      expect(protocols.length).toBe(2);
      expect(protocols.map((p) => p.protocol.id)).toEqual(
        expect.arrayContaining([protocolId1, protocolId2]),
      );
    });

    it("should return empty array when experiment has no protocols", async () => {
      const result = await repository.listProtocols(experimentId);
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toEqual([]);
    });
  });

  describe("removeProtocols", () => {
    it("should remove a protocol from an experiment", async () => {
      await repository.addProtocols(experimentId, [
        { protocolId: protocolId1, order: 0 },
        { protocolId: protocolId2, order: 1 },
      ]);
      const removeResult = await repository.removeProtocols(experimentId, [protocolId1]);
      expect(removeResult.isSuccess()).toBe(true);
      assertSuccess(removeResult);
      // Only protocolId2 should remain
      const listResult = await repository.listProtocols(experimentId);
      assertSuccess(listResult);
      const protocols = listResult.value;
      expect(protocols.length).toBe(1);
      expect(protocols[0].protocol.id).toBe(protocolId2);
    });

    it("should remove multiple protocols at once", async () => {
      // Add three protocols
      const protocolId3 = (
        await testApp.createProtocol({ name: "Protocol 3", createdBy: testUserId })
      ).id;
      await repository.addProtocols(experimentId, [
        { protocolId: protocolId1, order: 0 },
        { protocolId: protocolId2, order: 1 },
        { protocolId: protocolId3, order: 2 },
      ]);
      // Remove two protocols at once
      const removeResult = await repository.removeProtocols(experimentId, [
        protocolId1,
        protocolId3,
      ]);
      expect(removeResult.isSuccess()).toBe(true);
      assertSuccess(removeResult);
      // Only protocolId2 should remain
      const listResult = await repository.listProtocols(experimentId);
      assertSuccess(listResult);
      const protocols = listResult.value;
      expect(protocols.length).toBe(1);
      expect(protocols[0].protocol.id).toBe(protocolId2);
    });
  });

  describe("updateProtocolOrder", () => {
    it("should update the order of a protocol", async () => {
      await repository.addProtocols(experimentId, [
        { protocolId: protocolId1, order: 0 },
        { protocolId: protocolId2, order: 1 },
      ]);
      const updateResult = await repository.updateProtocolOrder(experimentId, protocolId1, 5);
      expect(updateResult.isSuccess()).toBe(true);
      assertSuccess(updateResult);
      const listResult = await repository.listProtocols(experimentId);
      assertSuccess(listResult);
      const updated = listResult.value.find((p) => p.protocol.id === protocolId1);
      expect(updated?.order).toBe(5);
    });
  });
});

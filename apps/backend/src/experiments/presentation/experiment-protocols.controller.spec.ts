import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { TestHarness } from "../../test/test-harness";
import type { ExperimentProtocolDto } from "../core/models/experiment-protocols.model";

describe("ExperimentProtocolsController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("listExperimentProtocols", () => {
    it("should return all protocols of an experiment", async () => {
      // Create experiment and protocols
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Protocols List",
        userId: testUserId,
      });
      const protocol1 = await testApp.createProtocol({
        name: "Protocol 1",
        createdBy: testUserId,
        family: "multispeq",
      });
      const protocol2 = await testApp.createProtocol({
        name: "Protocol 2",
        createdBy: testUserId,
        family: "ambit",
      });
      await testApp.addExperimentProtocol(experiment.id, protocol1.id, 0);
      await testApp.addExperimentProtocol(experiment.id, protocol2.id, 1);

      const path = testApp.resolvePath(contract.experiments.listExperimentProtocols.path, {
        id: experiment.id,
      });

      const response = await testApp.get(path).withAuth(testUserId).expect(StatusCodes.OK);
      expect(response.body).toHaveLength(2);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            order: 0,
            protocol: expect.objectContaining({
              id: protocol1.id,
              family: "multispeq",
            }) as Partial<ExperimentProtocolDto>,
          }),
          expect.objectContaining({
            order: 1,
            protocol: expect.objectContaining({
              id: protocol2.id,
              family: "ambit",
            }) as Partial<ExperimentProtocolDto>,
          }),
        ]),
      );
    });

    it("should return 404 if experiment doesn't exist", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      const path = testApp.resolvePath(contract.experiments.listExperimentProtocols.path, {
        id: nonExistentId,
      });
      await testApp.get(path).withAuth(testUserId).expect(StatusCodes.NOT_FOUND);
    });

    it("should return 400 for invalid experiment UUID", async () => {
      const invalidId = "not-a-uuid";
      const path = testApp.resolvePath(contract.experiments.listExperimentProtocols.path, {
        id: invalidId,
      });
      await testApp.get(path).withAuth(testUserId).expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 if not authenticated", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Protocols List",
        userId: testUserId,
      });
      const path = testApp.resolvePath(contract.experiments.listExperimentProtocols.path, {
        id: experiment.id,
      });
      await testApp.get(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("addExperimentProtocols", () => {
    it("should add new protocols to an experiment", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Adding Protocols",
        userId: testUserId,
      });
      const protocol1 = await testApp.createProtocol({
        name: "Protocol 1",
        createdBy: testUserId,
        family: "multispeq",
      });
      const protocol2 = await testApp.createProtocol({
        name: "Protocol 2",
        createdBy: testUserId,
        family: "ambit",
      });

      const path = testApp.resolvePath(contract.experiments.addExperimentProtocols.path, {
        id: experiment.id,
      });
      const body = {
        protocols: [
          { protocolId: protocol1.id, order: 0 },
          { protocolId: protocol2.id, order: 1 },
        ],
      };

      const response = await testApp
        .post(path)
        .withAuth(testUserId)
        .send(body)
        .expect(StatusCodes.CREATED);
      const protocols = response.body as ExperimentProtocolDto[];
      expect(protocols).toHaveLength(2);
      expect(protocols.some((p) => p.protocol.id === protocol1.id && p.order === 0)).toBe(true);
      expect(protocols.some((p) => p.protocol.id === protocol2.id && p.order === 1)).toBe(true);
    });

    it("should return 404 when adding protocols to non-existent experiment", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      const protocol1 = await testApp.createProtocol({
        name: "Protocol 1",
        createdBy: testUserId,
        family: "multispeq",
      });
      const path = testApp.resolvePath(contract.experiments.addExperimentProtocols.path, {
        id: nonExistentId,
      });
      await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ protocols: [{ protocolId: protocol1.id, order: 0 }] })
        .expect(StatusCodes.NOT_FOUND);
    });

    it("should return 400 for invalid protocol data", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Invalid Protocol Data",
        userId: testUserId,
      });
      const path = testApp.resolvePath(contract.experiments.addExperimentProtocols.path, {
        id: experiment.id,
      });
      // Missing protocolId
      await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ protocols: [{ order: 0 }] })
        .expect(StatusCodes.BAD_REQUEST);
      // Invalid order type
      await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ protocols: [{ protocolId: "not-a-uuid", order: "first" }] })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 if not authenticated", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Protocols Add",
        userId: testUserId,
      });
      const protocol1 = await testApp.createProtocol({
        name: "Protocol 1",
        createdBy: testUserId,
        family: "multispeq",
      });
      const path = testApp.resolvePath(contract.experiments.addExperimentProtocols.path, {
        id: experiment.id,
      });
      await testApp
        .post(path)
        .withoutAuth()
        .send({ protocols: [{ protocolId: protocol1.id, order: 0 }] })
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("removeExperimentProtocol", () => {
    it("should remove a protocol from an experiment", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Removing Protocol",
        userId: testUserId,
      });
      const protocol1 = await testApp.createProtocol({
        name: "Protocol 1",
        createdBy: testUserId,
        family: "multispeq",
      });
      await testApp.addExperimentProtocol(experiment.id, protocol1.id, 0);

      const path = testApp.resolvePath(contract.experiments.removeExperimentProtocol.path, {
        id: experiment.id,
        protocolId: protocol1.id,
      });

      await testApp.delete(path).withAuth(testUserId).expect(StatusCodes.NO_CONTENT);

      // Should be empty after removal
      const listPath = testApp.resolvePath(contract.experiments.listExperimentProtocols.path, {
        id: experiment.id,
      });
      const listResponse = await testApp.get(listPath).withAuth(testUserId).expect(StatusCodes.OK);
      expect(listResponse.body).toHaveLength(0);
    });

    it("should return 404 when removing protocol from non-existent experiment", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";
      const protocol1 = await testApp.createProtocol({
        name: "Protocol 1",
        createdBy: testUserId,
        family: "multispeq",
      });
      const path = testApp.resolvePath(contract.experiments.removeExperimentProtocol.path, {
        id: nonExistentId,
        protocolId: protocol1.id,
      });
      await testApp.delete(path).withAuth(testUserId).expect(StatusCodes.NOT_FOUND);
    });

    it("should return 404 when protocol doesn't exist in experiment", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Protocol Remove",
        userId: testUserId,
      });
      const nonExistentProtocolId = "00000000-0000-0000-0000-000000000000";
      const path = testApp.resolvePath(contract.experiments.removeExperimentProtocol.path, {
        id: experiment.id,
        protocolId: nonExistentProtocolId,
      });
      await testApp.delete(path).withAuth(testUserId).expect(StatusCodes.NOT_FOUND);
    });

    it("should return 400 for invalid UUIDs", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Protocol Remove Invalid",
        userId: testUserId,
      });
      const path = testApp.resolvePath(contract.experiments.removeExperimentProtocol.path, {
        id: experiment.id,
        protocolId: "not-a-uuid",
      });
      await testApp.delete(path).withAuth(testUserId).expect(StatusCodes.BAD_REQUEST);
    });

    it("should return 401 if not authenticated", async () => {
      const { experiment } = await testApp.createExperiment({
        name: "Test Experiment for Protocol Remove Auth",
        userId: testUserId,
      });
      const protocol1 = await testApp.createProtocol({
        name: "Protocol 1",
        createdBy: testUserId,
        family: "multispeq",
      });
      await testApp.addExperimentProtocol(experiment.id, protocol1.id, 0);
      const path = testApp.resolvePath(contract.experiments.removeExperimentProtocol.path, {
        id: experiment.id,
        protocolId: protocol1.id,
      });
      await testApp.delete(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });
  });
});

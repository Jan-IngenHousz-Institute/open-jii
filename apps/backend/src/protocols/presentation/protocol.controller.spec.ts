import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import type { ErrorResponse, Protocol, ProtocolList } from "@repo/api";
import { contract } from "@repo/api";

import { success } from "../../common/utils/fp-utils";
import { SuperTestResponse, TestHarness } from "../../test/test-harness";
import { CreateProtocolUseCase } from "../application/use-cases/create-protocol/create-protocol";
import { DeleteProtocolUseCase } from "../application/use-cases/delete-protocol/delete-protocol";
import { GetProtocolUseCase } from "../application/use-cases/get-protocol/get-protocol";
import { ListProtocolsUseCase } from "../application/use-cases/list-protocols/list-protocols";
import { UpdateProtocolUseCase } from "../application/use-cases/update-protocol/update-protocol";

describe("ProtocolController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let createProtocolUseCase: CreateProtocolUseCase;
  let getProtocolUseCase: GetProtocolUseCase;
  let listProtocolsUseCase: ListProtocolsUseCase;
  let updateProtocolUseCase: UpdateProtocolUseCase;
  let deleteProtocolUseCase: DeleteProtocolUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    // Get use case instances for mocking
    createProtocolUseCase = testApp.module.get(CreateProtocolUseCase);
    getProtocolUseCase = testApp.module.get(GetProtocolUseCase);
    listProtocolsUseCase = testApp.module.get(ListProtocolsUseCase);
    updateProtocolUseCase = testApp.module.get(UpdateProtocolUseCase);
    deleteProtocolUseCase = testApp.module.get(DeleteProtocolUseCase);

    // Reset any mocks before each test
    jest.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("createProtocol", () => {
    it("should successfully create a protocol", async () => {
      // Arrange
      const protocolData = {
        name: "Test Protocol",
        description: "Test Description",
        code: [{ steps: [{ name: "Step 1", action: "test" }] }],
      };

      // Act
      const response = await testApp
        .post(contract.protocols.createProtocol.path)
        .withAuth(testUserId)
        .send(protocolData)
        .expect(StatusCodes.CREATED);

      // Assert
      expect(response.body).toHaveProperty("id");
      expect(response.body).toMatchObject({
        name: protocolData.name,
        description: protocolData.description,
        code: protocolData.code,
        createdBy: testUserId,
      });
    });

    it("should handle validation errors", async () => {
      // Arrange
      const invalidData = {
        // Missing required name field
        description: "Test Description",
        code: [{ steps: [{ name: "Step 1", action: "test" }] }],
      };

      // Act & Assert
      await testApp
        .post(contract.protocols.createProtocol.path)
        .withAuth(testUserId)
        .send(invalidData)
        .expect(StatusCodes.BAD_REQUEST);
    });
  });

  describe("getProtocol", () => {
    it("should retrieve a protocol by id", async () => {
      // Arrange
      // Create a protocol to retrieve
      const createData = {
        name: "Protocol to Retrieve",
        description: "Test Description",
        code: [{ steps: [{ name: "Step 1", action: "test" }] }],
      };

      const createResponse = await testApp
        .post(contract.protocols.createProtocol.path)
        .withAuth(testUserId)
        .send(createData)
        .expect(StatusCodes.CREATED);

      const createdProtocol = createResponse.body as Protocol;

      // Act
      const path = testApp.resolvePath(contract.protocols.getProtocol.path, {
        id: createdProtocol.id,
      });
      const response = await testApp.get(path).withAuth(testUserId).expect(StatusCodes.OK);

      // Assert
      expect(response.body).toMatchObject({
        id: createdProtocol.id,
        name: createData.name,
        description: createData.description,
        code: createData.code,
        createdBy: testUserId,
      });
    });

    it("should return 404 for non-existent protocol", async () => {
      // Act & Assert
      const path = testApp.resolvePath(contract.protocols.getProtocol.path, {
        id: faker.string.uuid(),
      });
      await testApp.get(path).withAuth(testUserId).expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("listProtocols", () => {
    it("should list all protocols", async () => {
      // Arrange
      // Create some protocols to list
      const protocol1 = {
        name: "Protocol 1 for List",
        description: "Description 1",
        code: [{ steps: [{ name: "Step 1", action: "test" }] }],
      };

      const protocol2 = {
        name: "Protocol 2 for List",
        description: "Description 2",
        code: [{ steps: [{ name: "Step 2", action: "test" }] }],
      };

      await testApp
        .post(contract.protocols.createProtocol.path)
        .withAuth(testUserId)
        .send(protocol1);

      await testApp
        .post(contract.protocols.createProtocol.path)
        .withAuth(testUserId)
        .send(protocol2);

      // Act
      const response = await testApp
        .get(contract.protocols.listProtocols.path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      // Assert
      const protocols = response.body as ProtocolList;
      expect(protocols.length).toBeGreaterThanOrEqual(2);
      expect(protocols.some((p) => p.name === protocol1.name)).toBe(true);
      expect(protocols.some((p) => p.name === protocol2.name)).toBe(true);
    });

    it("should filter protocols by search term", async () => {
      // Arrange
      const uniquePrefix = "UniqueListTest";
      const protocol1 = {
        name: `${uniquePrefix} Protocol`,
        description: "Description 1",
        code: [{ steps: [{ name: "Step 1", action: "test" }] }],
      };

      const protocol2 = {
        name: "Different Protocol",
        description: "Description 2",
        code: { steps: [{ name: "Step 2", action: "test" }] },
      };

      await testApp
        .post(contract.protocols.createProtocol.path)
        .withAuth(testUserId)
        .send(protocol1);

      await testApp
        .post(contract.protocols.createProtocol.path)
        .withAuth(testUserId)
        .send(protocol2);

      // Act
      const response = await testApp
        .get(`${contract.protocols.listProtocols.path}?search=${uniquePrefix}`)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      // Assert
      const protocols = response.body as ProtocolList;
      expect(protocols.some((p) => p.name === protocol1.name)).toBe(true);
      expect(protocols.every((p) => p.name !== protocol2.name)).toBe(true);
    });
  });

  describe("updateProtocol", () => {
    it("should update a protocol", async () => {
      // Arrange
      // Create a protocol to update
      const createData = {
        name: "Protocol to Update",
        description: "Original Description",
        code: [{ steps: [{ name: "Original Step", action: "test" }] }],
      };

      const createResponse = await testApp
        .post(contract.protocols.createProtocol.path)
        .withAuth(testUserId)
        .send(createData)
        .expect(StatusCodes.CREATED);

      const createdProtocol = createResponse.body as Protocol;

      const updateData = {
        name: "Updated Protocol",
        description: "Updated Description",
        code: [{ steps: [{ name: "Updated Step", action: "updated" }] }],
      };

      // Act
      const path = testApp.resolvePath(contract.protocols.updateProtocol.path, {
        id: createdProtocol.id,
      });
      const response = await testApp
        .patch(path)
        .withAuth(testUserId)
        .send(updateData)
        .expect(StatusCodes.OK);

      // Assert
      expect(response.body).toMatchObject({
        id: createdProtocol.id,
        name: updateData.name,
        description: updateData.description,
        code: updateData.code,
        createdBy: testUserId,
      });

      // Verify update was persisted
      const getPath = testApp.resolvePath(contract.protocols.getProtocol.path, {
        id: createdProtocol.id,
      });
      const getResponse = await testApp.get(getPath).withAuth(testUserId).expect(StatusCodes.OK);

      expect(getResponse.body).toMatchObject({
        name: updateData.name,
        description: updateData.description,
        code: updateData.code,
      });
    });

    it("should update a protocol with partial data", async () => {
      // Arrange
      // Create a protocol to update
      const createData = {
        name: "Protocol for Partial Update",
        description: "Original Description",
        code: [{ steps: [{ name: "Original Step", action: "test" }] }],
      };

      const createResponse = await testApp
        .post(contract.protocols.createProtocol.path)
        .withAuth(testUserId)
        .send(createData)
        .expect(StatusCodes.CREATED);

      const createdProtocol = createResponse.body as Protocol;

      // Only update the name
      const updateData = {
        name: "Partially Updated Protocol",
      };

      // Act
      const path = testApp.resolvePath(contract.protocols.updateProtocol.path, {
        id: createdProtocol.id,
      });
      const response = await testApp
        .patch(path)
        .withAuth(testUserId)
        .send(updateData)
        .expect(StatusCodes.OK);

      // Assert
      expect(response.body).toMatchObject({
        id: createdProtocol.id,
        name: updateData.name,
        // These should remain unchanged
        description: createData.description,
        code: createData.code,
      });
    });

    it("should return 404 for non-existent protocol", async () => {
      // Arrange
      const updateData = {
        name: "Updated Protocol",
      };

      // Act & Assert
      const path = testApp.resolvePath(contract.protocols.updateProtocol.path, {
        id: faker.string.uuid(),
      });
      await testApp.patch(path).withAuth(testUserId).send(updateData).expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("deleteProtocol", () => {
    it("should delete a protocol", async () => {
      // Arrange
      // Create a protocol to delete
      const createData = {
        name: "Protocol to Delete",
        description: "Will be deleted",
        code: [{ steps: [{ name: "Delete me", action: "test" }] }],
      };

      const createResponse = await testApp
        .post(contract.protocols.createProtocol.path)
        .withAuth(testUserId)
        .send(createData)
        .expect(StatusCodes.CREATED);

      const createdProtocol = createResponse.body as Protocol;

      // Act
      const deletePath = testApp.resolvePath(contract.protocols.deleteProtocol.path, {
        id: createdProtocol.id,
      });
      await testApp.delete(deletePath).withAuth(testUserId).expect(StatusCodes.NO_CONTENT);

      // Assert - Verify protocol was deleted
      const getPath = testApp.resolvePath(contract.protocols.getProtocol.path, {
        id: createdProtocol.id,
      });
      await testApp.get(getPath).withAuth(testUserId).expect(StatusCodes.NOT_FOUND);
    });

    it("should return 404 for non-existent protocol", async () => {
      // Act & Assert
      const path = testApp.resolvePath(contract.protocols.deleteProtocol.path, {
        id: faker.string.uuid(),
      });
      await testApp.delete(path).withAuth(testUserId).expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("parseProtocolCode function", () => {
    it("should correctly parse string code into JSON object", async () => {
      // Arrange
      // Mock getProtocolUseCase to return a protocol with stringified code
      const mockProtocol = {
        id: faker.string.uuid(),
        name: "Protocol with Stringified Code",
        description: "Testing code parsing",
        code: JSON.stringify({ steps: [{ name: "Step 1", action: "test" }] }),
        family: "multispeq" as const,
        createdBy: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(getProtocolUseCase, "execute").mockResolvedValue(success(mockProtocol));

      // Act
      const path = testApp.resolvePath(contract.protocols.getProtocol.path, {
        id: mockProtocol.id,
      });
      const response = await testApp.get(path).withAuth(testUserId).expect(StatusCodes.OK);

      // Assert - the code should be parsed from string to object
      expect(response.body.code).toEqual({ steps: [{ name: "Step 1", action: "test" }] });
    });

    it("should handle invalid JSON in code field", async () => {
      // Arrange
      // Mock getProtocolUseCase to return a protocol with invalid JSON code
      const mockProtocol = {
        id: faker.string.uuid(),
        name: "Protocol with Invalid Code",
        description: "Testing invalid code parsing",
        code: "{ invalid json", // This is not valid JSON
        family: "multispeq" as const,
        createdBy: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(getProtocolUseCase, "execute").mockResolvedValue(success(mockProtocol));

      // Act & Assert
      const path = testApp.resolvePath(contract.protocols.getProtocol.path, {
        id: mockProtocol.id,
      });
      const response = await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });
  });
});

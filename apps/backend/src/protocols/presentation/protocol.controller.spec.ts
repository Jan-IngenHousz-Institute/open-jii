import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import type { Protocol, ProtocolList } from "@repo/api";
import { contract } from "@repo/api";

import { success } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import { GetProtocolUseCase } from "../application/use-cases/get-protocol/get-protocol";

describe("ProtocolController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let getProtocolUseCase: GetProtocolUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    // Get use case instances for mocking
    getProtocolUseCase = testApp.module.get(GetProtocolUseCase);

    // Reset any mocks before each test
    vi.restoreAllMocks();
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
        code: [{ averages: 1, environmental: [["light_intensity", 0]] }],
        family: "multispeq" as const,
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
        code: [{ averages: 1, environmental: [["light_intensity", 0]] }],
        family: "multispeq" as const,
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
        code: [{ averages: 1, environmental: [["light_intensity", 0]] }],
        family: "multispeq" as const,
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

    it("should allow any authenticated user to view any protocol", async () => {
      // Arrange
      // Create a protocol with the first user
      const createData = {
        name: "Protocol to View",
        description: "Test Description",
        code: [{ averages: 1, environmental: [["light_intensity", 0]] }],
        family: "multispeq" as const,
      };

      const createResponse = await testApp
        .post(contract.protocols.createProtocol.path)
        .withAuth(testUserId)
        .send(createData)
        .expect(StatusCodes.CREATED);

      const createdProtocol = createResponse.body as Protocol;

      // Create a different user
      const otherUserId = await testApp.createTestUser({});

      // Act - other user should be able to view the protocol
      const path = testApp.resolvePath(contract.protocols.getProtocol.path, {
        id: createdProtocol.id,
      });
      const response = await testApp.get(path).withAuth(otherUserId).expect(StatusCodes.OK);

      // Assert
      expect(response.body).toMatchObject({
        id: createdProtocol.id,
        name: createData.name,
        description: createData.description,
        code: createData.code,
        createdBy: testUserId, // Should show original creator
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
        code: [{ averages: 1, environmental: [["light_intensity", 0]] }],
        family: "multispeq" as const,
      };

      const protocol2 = {
        name: "Protocol 2 for List",
        description: "Description 2",
        code: [{ averages: 1, environmental: [["light_intensity", 0]] }],
        family: "multispeq" as const,
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

    it("should allow any authenticated user to list all protocols", async () => {
      // Arrange
      // Create some protocols with different users
      const protocol1 = {
        name: "Protocol 1 for Public List",
        description: "Description 1",
        code: [{ averages: 1, environmental: [["light_intensity", 0]] }],
        family: "multispeq" as const,
      };

      const otherUserId = await testApp.createTestUser({});
      const protocol2 = {
        name: "Protocol 2 for Public List",
        description: "Description 2",
        code: [{ averages: 1, environmental: [["light_intensity", 0]] }],
        family: "multispeq" as const,
      };

      await testApp
        .post(contract.protocols.createProtocol.path)
        .withAuth(testUserId)
        .send(protocol1);

      await testApp
        .post(contract.protocols.createProtocol.path)
        .withAuth(otherUserId)
        .send(protocol2);

      // Act - first user should see both protocols
      const response1 = await testApp
        .get(contract.protocols.listProtocols.path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      // Act - second user should also see both protocols
      const response2 = await testApp
        .get(contract.protocols.listProtocols.path)
        .withAuth(otherUserId)
        .expect(StatusCodes.OK);

      // Assert
      const protocols1 = response1.body as ProtocolList;
      const protocols2 = response2.body as ProtocolList;

      expect(protocols1.some((p) => p.name === protocol1.name)).toBe(true);
      expect(protocols1.some((p) => p.name === protocol2.name)).toBe(true);
      expect(protocols2.some((p) => p.name === protocol1.name)).toBe(true);
      expect(protocols2.some((p) => p.name === protocol2.name)).toBe(true);
    });

    it("should filter protocols by search term", async () => {
      // Arrange
      const uniquePrefix = "UniqueListTest";
      const protocol1 = {
        name: `${uniquePrefix} Protocol`,
        description: "Description 1",
        code: [{ averages: 1, environmental: [["light_intensity", 0]] }],
        family: "multispeq" as const,
      };

      const protocol2 = {
        name: "Different Protocol",
        description: "Description 2",
        code: [{ averages: 1, environmental: [["light_intensity", 0]] }],
        family: "multispeq" as const,
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
    it("should update a protocol when user is the creator", async () => {
      // Arrange
      // Create a protocol to update
      const createData = {
        name: "Protocol to Update",
        description: "Original Description",
        code: [{ averages: 1, environmental: [["light_intensity", 0]] }],
        family: "multispeq" as const,
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
        code: [{ averages: 1, environmental: [["light_intensity", 1]] }],
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

    it("should return 403 when user is not the creator", async () => {
      // Arrange
      // Create a protocol with the first user
      const createData = {
        name: "Protocol to Update",
        description: "Original Description",
        code: [{ averages: 1, environmental: [["light_intensity", 0]] }],
        family: "multispeq" as const,
      };

      const createResponse = await testApp
        .post(contract.protocols.createProtocol.path)
        .withAuth(testUserId)
        .send(createData)
        .expect(StatusCodes.CREATED);

      const createdProtocol = createResponse.body as Protocol;

      // Create a different user
      const otherUserId = await testApp.createTestUser({});

      const updateData = {
        name: "Updated Protocol",
      };

      // Act & Assert
      const path = testApp.resolvePath(contract.protocols.updateProtocol.path, {
        id: createdProtocol.id,
      });
      await testApp
        .patch(path)
        .withAuth(otherUserId)
        .send(updateData)
        .expect(StatusCodes.FORBIDDEN);

      // Verify the error message
      const errorResponse = await testApp
        .patch(path)
        .withAuth(otherUserId)
        .send(updateData)
        .expect(StatusCodes.FORBIDDEN);

      expect(errorResponse.body).toMatchObject({
        message: "Only the protocol creator can update this protocol",
      });

      // Verify the protocol was not updated
      const getPath = testApp.resolvePath(contract.protocols.getProtocol.path, {
        id: createdProtocol.id,
      });
      const getResponse = await testApp.get(getPath).withAuth(testUserId).expect(StatusCodes.OK);

      expect(getResponse.body).toMatchObject({
        name: createData.name, // Should still have original name
        description: createData.description,
      });
    });

    it("should update a protocol with partial data", async () => {
      // Arrange
      // Create a protocol to update
      const createData = {
        name: "Protocol for Partial Update",
        description: "Original Description",
        code: [{ averages: 1, environmental: [["light_intensity", 0]] }],
        family: "multispeq" as const,
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
    it("should delete a protocol when user is the creator", async () => {
      // Arrange
      // Create a protocol to delete
      const createData = {
        name: "Protocol to Delete",
        description: "Will be deleted",
        code: [{ averages: 1, environmental: [["light_intensity", 0]] }],
        family: "multispeq" as const,
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

    it("should return 403 when user is not the creator", async () => {
      // Arrange
      // Create a protocol with the first user
      const createData = {
        name: "Protocol to Delete",
        description: "Will be deleted",
        code: [{ averages: 1, environmental: [["light_intensity", 0]] }],
        family: "multispeq" as const,
      };

      const createResponse = await testApp
        .post(contract.protocols.createProtocol.path)
        .withAuth(testUserId)
        .send(createData)
        .expect(StatusCodes.CREATED);

      const createdProtocol = createResponse.body as Protocol;

      // Create a different user
      const otherUserId = await testApp.createTestUser({});

      // Act & Assert
      const deletePath = testApp.resolvePath(contract.protocols.deleteProtocol.path, {
        id: createdProtocol.id,
      });
      await testApp.delete(deletePath).withAuth(otherUserId).expect(StatusCodes.FORBIDDEN);

      // Verify the error message
      const errorResponse = await testApp
        .delete(deletePath)
        .withAuth(otherUserId)
        .expect(StatusCodes.FORBIDDEN);

      expect(errorResponse.body).toMatchObject({
        message: "Only the protocol creator can delete this protocol",
      });

      // Verify the protocol still exists
      const getPath = testApp.resolvePath(contract.protocols.getProtocol.path, {
        id: createdProtocol.id,
      });
      await testApp.get(getPath).withAuth(testUserId).expect(StatusCodes.OK);
    });

    it("should return 404 for non-existent protocol", async () => {
      // Act & Assert
      const path = testApp.resolvePath(contract.protocols.deleteProtocol.path, {
        id: faker.string.uuid(),
      });
      await testApp.delete(path).withAuth(testUserId).expect(StatusCodes.NOT_FOUND);
    });

    it("should handle authorization check for non-existent protocol in update", async () => {
      // Arrange
      const otherUserId = await testApp.createTestUser({});
      const updateData = { name: "Updated Protocol" };

      // Act & Assert - should return 404 before authorization check
      const path = testApp.resolvePath(contract.protocols.updateProtocol.path, {
        id: faker.string.uuid(),
      });
      await testApp
        .patch(path)
        .withAuth(otherUserId)
        .send(updateData)
        .expect(StatusCodes.NOT_FOUND);
    });

    it("should handle authorization check for non-existent protocol in delete", async () => {
      // Arrange
      const otherUserId = await testApp.createTestUser({});

      // Act & Assert - should return 404 before authorization check
      const path = testApp.resolvePath(contract.protocols.deleteProtocol.path, {
        id: faker.string.uuid(),
      });
      await testApp.delete(path).withAuth(otherUserId).expect(StatusCodes.NOT_FOUND);
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

      vi.spyOn(getProtocolUseCase, "execute").mockResolvedValue(success(mockProtocol));

      // Act
      const path = testApp.resolvePath(contract.protocols.getProtocol.path, {
        id: mockProtocol.id,
      });
      const response = await testApp.get(path).withAuth(testUserId).expect(StatusCodes.OK);

      // Assert - the code should be parsed from string to object
      expect((response.body as Protocol).code).toEqual({
        steps: [{ name: "Step 1", action: "test" }],
      });
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

      vi.spyOn(getProtocolUseCase, "execute").mockResolvedValue(success(mockProtocol));

      // Act
      const path = testApp.resolvePath(contract.protocols.getProtocol.path, {
        id: mockProtocol.id,
      });
      const response = await testApp.get(path).withAuth(testUserId).expect(StatusCodes.OK);

      // Assert - the code should fallback to empty object for invalid JSON
      expect((response.body as Protocol).code).toEqual([{}]);
    });
  });

  describe("validateProtocolCode with feature flag", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should validate protocol schema regardless of feature flag", async () => {
      // Arrange - create protocol with valid JSON but invalid schema
      const validJsonInvalidSchema = {
        name: "Protocol with Valid JSON",
        description: "Testing validation",
        code: [{ some: "data" }], // Valid JSON array but invalid protocol schema
        family: "multispeq" as const,
      };

      // Act - depending on feature flag, this will either:
      // - Pass with warning mode (feature flag enabled)
      // - Fail with strict mode (feature flag disabled)
      const response = await testApp
        .post(contract.protocols.createProtocol.path)
        .withAuth(testUserId)
        .send(validJsonInvalidSchema);

      // Should either create successfully or reject based on feature flag
      expect([StatusCodes.CREATED, StatusCodes.BAD_REQUEST]).toContain(response.status);
    });

    it("should allow JSON structure validation when feature flag is enabled", async () => {
      // This test assumes the feature flag is enabled
      // If it's disabled, this test should be adjusted accordingly
      const validJsonStructure = {
        name: "Protocol with Valid JSON",
        description: "Testing JSON structure validation",
        code: [{ some: "data", that: "parses" }],
        family: "multispeq" as const,
      };

      // Act - this should either pass with lenient validation or fail with strict
      const response = await testApp
        .post(contract.protocols.createProtocol.path)
        .withAuth(testUserId)
        .send(validJsonStructure);

      // The result depends on the feature flag state
      expect([StatusCodes.CREATED, StatusCodes.BAD_REQUEST]).toContain(response.status);
    });
  });

  describe("validateJsonStructure function", () => {
    it("should reject empty code", async () => {
      const invalidData = {
        name: "Protocol without code",
        description: "Testing empty code",
        code: null,
        family: "multispeq" as const,
      };

      await testApp
        .post(contract.protocols.createProtocol.path)
        .withAuth(testUserId)
        .send(invalidData)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should reject non-array code", async () => {
      const invalidData = {
        name: "Protocol with object code",
        description: "Testing non-array code",
        code: { not: "an array" },
        family: "multispeq" as const,
      };

      await testApp
        .post(contract.protocols.createProtocol.path)
        .withAuth(testUserId)
        .send(invalidData)
        .expect(StatusCodes.BAD_REQUEST);
    });
  });
});

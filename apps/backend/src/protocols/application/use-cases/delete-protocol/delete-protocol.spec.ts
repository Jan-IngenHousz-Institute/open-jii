import { faker } from "@faker-js/faker";

import { eq, notifications, protocols } from "@repo/database";

import { AppError, assertFailure, assertSuccess, failure } from "../../../../common/utils/fp-utils";
import { NotificationRepository } from "../../../../notifications/core/repositories/notification.repository";
import { SharingRepository } from "../../../../sharing/core/repositories/sharing.repository";
import {
  audienceDeliveries,
  audienceNotifications,
  grantResourceAudience,
  heardByAllButTheActor,
  seedResourceAudience,
} from "../../../../test/resource-audience";
import { TestHarness } from "../../../../test/test-harness";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";
import { DeleteProtocolUseCase } from "./delete-protocol";

describe("DeleteProtocolUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: DeleteProtocolUseCase;
  let protocolRepository: ProtocolRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(DeleteProtocolUseCase);
    protocolRepository = testApp.module.get(ProtocolRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should delete a protocol by id", async () => {
    // Arrange
    const protocolData = {
      name: "Protocol to Delete",
      description: "This protocol will be deleted",
      code: [{ steps: [{ name: "Step 1", action: "test" }] }],
      family: "multispeq" as const,
    };

    // Create a protocol to delete
    const createResult = await protocolRepository.create(protocolData, testUserId);
    assertSuccess(createResult);
    const createdProtocol = createResult.value[0];

    // Act
    const result = await useCase.execute(createdProtocol.id, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const deletedProtocol = result.value;

    // Verify the deleted protocol information is correct
    expect(deletedProtocol).toMatchObject({
      id: createdProtocol.id,
      name: protocolData.name,
    });

    // Verify the protocol is actually deleted by trying to find it
    const findResult = await protocolRepository.findOne(createdProtocol.id);
    assertSuccess(findResult);
    expect(findResult.value).toBeNull();
  });

  it("should return not found error for non-existent protocol", async () => {
    // Act
    const result = await useCase.execute(faker.string.uuid(), testUserId);

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error).toMatchObject({
      code: "NOT_FOUND",
      message: "Protocol not found",
      statusCode: 404,
    });
  });

  /** One protocol in an organization, shared with an admin and a viewer. */
  async function sharedProtocol() {
    const audience = await seedResourceAudience(testApp);
    const resourceId = (
      await testApp.createProtocol({
        name: "Dark Adaptation",
        createdBy: audience.owner,
        organizationId: audience.organizationId,
      })
    ).id;
    await grantResourceAudience(testApp, audience, "protocol", resourceId);
    return { audience, resourceId };
  }

  it("tells the grantees and the owner, not the deleter, and queues their emails", async () => {
    const { audience, resourceId } = await sharedProtocol();

    assertSuccess(await useCase.execute(resourceId, audience.actor));

    expect(await audienceNotifications(testApp, audience)).toEqual(
      heardByAllButTheActor(audience, (recipientId) => ({
        type: "resource_deleted",
        recipientId,
        actorId: audience.actor,
        resourceType: "protocol",
        resourceId,
        params: { resourceName: "Dark Adaptation" },
      })),
    );
    expect(await audienceDeliveries(testApp, audience)).toEqual(
      heardByAllButTheActor(audience, () => ({ type: "resource_deleted", status: "pending" })),
    );
  });

  it("still deletes, telling nobody, when the members cannot be read", async () => {
    const { audience, resourceId } = await sharedProtocol();
    vi.spyOn(testApp.module.get(SharingRepository), "listMemberIds").mockResolvedValue(
      failure(AppError.internal("members unavailable")),
    );

    assertSuccess(await useCase.execute(resourceId, audience.actor));

    expect(
      await testApp.database.select().from(protocols).where(eq(protocols.id, resourceId)),
    ).toEqual([]);
    expect(await testApp.database.select().from(notifications)).toEqual([]);
  });

  it("still deletes when the notification cannot be stored", async () => {
    const { audience, resourceId } = await sharedProtocol();
    vi.spyOn(testApp.module.get(NotificationRepository), "insertMany").mockResolvedValue(
      failure(AppError.internal("notifications unavailable")),
    );

    assertSuccess(await useCase.execute(resourceId, audience.actor));

    expect(
      await testApp.database.select().from(protocols).where(eq(protocols.id, resourceId)),
    ).toEqual([]);
    expect(await testApp.database.select().from(notifications)).toEqual([]);
  });
});

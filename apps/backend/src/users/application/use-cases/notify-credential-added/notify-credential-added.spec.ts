import { Logger } from "@nestjs/common";

import { eq, notifications } from "@repo/database";

import { AppError, assertFailure, assertSuccess, failure } from "../../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../../notifications/application/services/notification-dispatch.service";
import { NotificationRepository } from "../../../../notifications/core/repositories/notification.repository";
import { queuedDeliveriesFor } from "../../../../test/notification-deliveries";
import { TestHarness } from "../../../../test/test-harness";
import { NotifyCredentialAddedUseCase } from "./notify-credential-added";

const GOOGLE_PASSWORD_MANAGER = "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4";
const ANONYMOUS = "00000000-0000-0000-0000-000000000000";

describe("NotifyCredentialAddedUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: NotifyCredentialAddedUseCase;
  let ownerId: string;

  const rowsFor = (userId: string) =>
    testApp.database.select().from(notifications).where(eq(notifications.recipientId, userId));

  const deliveriesFor = (userId: string) => queuedDeliveriesFor(testApp.database, userId);

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(NotifyCredentialAddedUseCase);
    ownerId = await testApp.createTestUser({ name: "Alice Owner" });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("tells the owner about a new API key and queues their email", async () => {
    assertSuccess(
      await useCase.execute({ kind: "api_key", userId: ownerId, name: "Field laptop" }),
    );

    expect(await rowsFor(ownerId)).toMatchObject([
      {
        type: "api_key_created",
        recipientId: ownerId,
        actorId: null,
        resourceType: null,
        resourceId: null,
        dedupeKey: null,
        params: { keyName: "Field laptop" },
      },
    ]);
    expect(await deliveriesFor(ownerId)).toMatchObject([
      { type: "api_key_created", channel: "email", status: "pending" },
    ]);
  });

  it.each([
    [
      "the name it was given",
      "Field laptop",
      GOOGLE_PASSWORD_MANAGER,
      { passkeyName: "Field laptop" },
    ],
    [
      "its authenticator when it has no name",
      null,
      GOOGLE_PASSWORD_MANAGER,
      { passkeyName: "Google Password Manager" },
    ],
    ["nothing for an anonymised authenticator", null, ANONYMOUS, {}],
    ["nothing for an unknown authenticator", null, "11111111-2222-3333-4444-555555555555", {}],
    ["nothing for a blank name and no authenticator", "   ", null, {}],
  ])("calls a new passkey after %s", async (_case, name, aaguid, params) => {
    assertSuccess(await useCase.execute({ kind: "passkey", userId: ownerId, name, aaguid }));

    const rows = await rowsFor(ownerId);
    expect(rows).toMatchObject([
      {
        type: "passkey_added",
        recipientId: ownerId,
        actorId: null,
        resourceType: null,
        resourceId: null,
        dedupeKey: null,
      },
    ]);
    expect(rows[0]?.params).toEqual(params);
    expect(await deliveriesFor(ownerId)).toMatchObject([
      { type: "passkey_added", channel: "email", status: "pending" },
    ]);
  });

  it("queues the email even with account security saved off", async () => {
    // The preferences use case refuses this write; the repository does not.
    assertSuccess(
      await testApp.module
        .get(NotificationRepository)
        .upsertPreference(ownerId, "account_security", "email", false),
    );

    assertSuccess(
      await useCase.execute({ kind: "api_key", userId: ownerId, name: "Field laptop" }),
    );

    expect(await deliveriesFor(ownerId)).toHaveLength(1);
  });

  it("stores the row but queues no email for an address that is an ORCID id", async () => {
    const orcidId = await testApp.createTestUser({ email: "0000-0002-1825-0097" });

    assertSuccess(
      await useCase.execute({ kind: "api_key", userId: orcidId, name: "Field laptop" }),
    );

    expect(await rowsFor(orcidId)).toHaveLength(1);
    expect(await deliveriesFor(orcidId)).toEqual([]);
  });

  it("logs and returns a failure when the notification cannot be dispatched, without the name", async () => {
    vi.spyOn(testApp.module.get(NotificationDispatchService), "dispatch").mockResolvedValue(
      failure(AppError.internal("notifications unavailable")),
    );
    const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    assertFailure(
      await useCase.execute({ kind: "api_key", userId: ownerId, name: "Field laptop" }),
    );

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "notify-credential-added",
        kind: "api_key",
        userId: ownerId,
      }),
    );
    expect(JSON.stringify(error.mock.calls)).not.toContain("Field laptop");
  });
});

import { TestHarness } from "../../../../test/test-harness";
import { assertFailure, assertSuccess, failure, success } from "../../../utils/fp-utils";
import { EmailAdapter } from "./email.adapter";
import { NotificationsService } from "./notifications/notifications.service";

describe("EmailAdapter", () => {
  const testApp = TestHarness.App;
  let adapter: EmailAdapter;
  let notificationsService: NotificationsService;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    adapter = testApp.module.get(EmailAdapter);
    notificationsService = testApp.module.get(NotificationsService);

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("sendAddedUserNotification", () => {
    const MOCK_EXPERIMENT_ID = "exp-123";
    const MOCK_EXPERIMENT_NAME = "Test Experiment";
    const MOCK_ACTOR = "John Doe";
    const MOCK_ROLE = "researcher";
    const MOCK_EMAIL = "test@example.com";

    it("should successfully delegate to NotificationsService and return success", async () => {
      // Arrange
      const mockResult = success(undefined);
      const notificationSpy = vi
        .spyOn(notificationsService, "sendAddedUserNotification")
        .mockResolvedValue(mockResult);

      // Act
      const result = await adapter.sendAddedUserNotification(
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
        MOCK_ACTOR,
        MOCK_ROLE,
        MOCK_EMAIL,
      );

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      // Verify the service was called with correct parameters
      expect(notificationSpy).toHaveBeenCalledOnce();
      expect(notificationSpy).toHaveBeenCalledWith(
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
        MOCK_ACTOR,
        MOCK_ROLE,
        MOCK_EMAIL,
      );
    });

    it("should delegate to NotificationsService and return failure when service fails", async () => {
      // Arrange
      const mockError = failure({
        name: "InternalError",
        code: "INTERNAL_ERROR",
        message: "Email service failed",
        statusCode: 500,
      });
      const notificationSpy = vi
        .spyOn(notificationsService, "sendAddedUserNotification")
        .mockResolvedValue(mockError);

      // Act
      const result = await adapter.sendAddedUserNotification(
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
        MOCK_ACTOR,
        MOCK_ROLE,
        MOCK_EMAIL,
      );

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toBe("Email service failed");

      // Verify the service was called
      expect(notificationSpy).toHaveBeenCalledOnce();
    });

    it("should handle exceptions from NotificationsService", async () => {
      // Arrange
      const mockError = new Error("Unexpected service error");
      const notificationSpy = vi
        .spyOn(notificationsService, "sendAddedUserNotification")
        .mockRejectedValue(mockError);

      // Act & Assert
      await expect(
        adapter.sendAddedUserNotification(
          MOCK_EXPERIMENT_ID,
          MOCK_EXPERIMENT_NAME,
          MOCK_ACTOR,
          MOCK_ROLE,
          MOCK_EMAIL,
        ),
      ).rejects.toThrow("Unexpected service error");

      // Verify the service was called
      expect(notificationSpy).toHaveBeenCalledOnce();
    });

    it("should pass through all parameters correctly", async () => {
      // Arrange
      const customExperimentId = "custom-exp-456";
      const customExperimentName = "Custom Experiment Name";
      const customActor = "Jane Smith";
      const customRole = "admin";
      const customEmail = "custom@example.com";

      const mockResult = success(undefined);
      const notificationSpy = vi
        .spyOn(notificationsService, "sendAddedUserNotification")
        .mockResolvedValue(mockResult);

      // Act
      await adapter.sendAddedUserNotification(
        customExperimentId,
        customExperimentName,
        customActor,
        customRole,
        customEmail,
      );

      // Assert
      expect(notificationSpy).toHaveBeenCalledWith(
        customExperimentId,
        customExperimentName,
        customActor,
        customRole,
        customEmail,
      );
    });
  });
});

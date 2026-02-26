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

  describe("sendTransferRequestConfirmation", () => {
    const MOCK_EMAIL = "test@example.com";
    const MOCK_PROJECT_ID_OLD = "project-123";
    const MOCK_PROJECT_URL_OLD = "https://photosynq.org/projects/123";

    it("should successfully delegate to NotificationsService and return success", async () => {
      // Arrange
      const mockResult = success(undefined);
      const notificationSpy = vi
        .spyOn(notificationsService, "sendTransferRequestConfirmation")
        .mockResolvedValue(mockResult);

      // Act
      const result = await adapter.sendTransferRequestConfirmation(
        MOCK_EMAIL,
        MOCK_PROJECT_ID_OLD,
        MOCK_PROJECT_URL_OLD,
      );

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      // Verify the service was called with correct parameters
      expect(notificationSpy).toHaveBeenCalledOnce();
      expect(notificationSpy).toHaveBeenCalledWith(
        MOCK_EMAIL,
        MOCK_PROJECT_ID_OLD,
        MOCK_PROJECT_URL_OLD,
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
        .spyOn(notificationsService, "sendTransferRequestConfirmation")
        .mockResolvedValue(mockError);

      // Act
      const result = await adapter.sendTransferRequestConfirmation(
        MOCK_EMAIL,
        MOCK_PROJECT_ID_OLD,
        MOCK_PROJECT_URL_OLD,
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
        .spyOn(notificationsService, "sendTransferRequestConfirmation")
        .mockRejectedValue(mockError);

      // Act & Assert
      await expect(
        adapter.sendTransferRequestConfirmation(
          MOCK_EMAIL,
          MOCK_PROJECT_ID_OLD,
          MOCK_PROJECT_URL_OLD,
        ),
      ).rejects.toThrow("Unexpected service error");

      // Verify the service was called
      expect(notificationSpy).toHaveBeenCalledOnce();
    });

    it("should pass through all parameters correctly", async () => {
      // Arrange
      const customEmail = "custom@example.com";
      const customProjectIdOld = "custom-project-789";
      const customProjectUrlOld = "https://photosynq.org/projects/789";

      const mockResult = success(undefined);
      const notificationSpy = vi
        .spyOn(notificationsService, "sendTransferRequestConfirmation")
        .mockResolvedValue(mockResult);

      // Act
      await adapter.sendTransferRequestConfirmation(
        customEmail,
        customProjectIdOld,
        customProjectUrlOld,
      );

      // Assert
      expect(notificationSpy).toHaveBeenCalledWith(
        customEmail,
        customProjectIdOld,
        customProjectUrlOld,
      );
    });
  });

  describe("sendInvitationEmail", () => {
    const MOCK_RESOURCE_ID = "res-123";
    const MOCK_RESOURCE_NAME = "Test Experiment";
    const MOCK_ACTOR = "John Doe";

    it("should send an email and return success", async () => {
      const notificationSpy = vi
        .spyOn(notificationsService, "sendAddedUserNotification")
        .mockResolvedValue(success(undefined));

      const result = await adapter.sendInvitationEmail(
        MOCK_RESOURCE_ID,
        MOCK_RESOURCE_NAME,
        MOCK_ACTOR,
        "member",
        "invite@example.com",
      );

      assertSuccess(result);
      expect(notificationSpy).toHaveBeenCalledOnce();
      expect(notificationSpy).toHaveBeenCalledWith(
        MOCK_RESOURCE_ID,
        MOCK_RESOURCE_NAME,
        MOCK_ACTOR,
        "member",
        "invite@example.com",
      );
    });
  });

  describe("sendProjectTransferComplete", () => {
    const MOCK_EMAIL = "test@example.com";
    const MOCK_EXPERIMENT_ID = "exp-456";
    const MOCK_EXPERIMENT_NAME = "Transferred Experiment";

    it("should successfully delegate to NotificationsService and return success", async () => {
      // Arrange
      const mockResult = success(undefined);
      const notificationSpy = vi
        .spyOn(notificationsService, "sendProjectTransferComplete")
        .mockResolvedValue(mockResult);

      // Act
      const result = await adapter.sendProjectTransferComplete(
        MOCK_EMAIL,
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
      );

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      // Verify the service was called with correct parameters
      expect(notificationSpy).toHaveBeenCalledOnce();
      expect(notificationSpy).toHaveBeenCalledWith(
        MOCK_EMAIL,
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
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
        .spyOn(notificationsService, "sendProjectTransferComplete")
        .mockResolvedValue(mockError);

      // Act
      const result = await adapter.sendProjectTransferComplete(
        MOCK_EMAIL,
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
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
        .spyOn(notificationsService, "sendProjectTransferComplete")
        .mockRejectedValue(mockError);

      // Act & Assert
      await expect(
        adapter.sendProjectTransferComplete(MOCK_EMAIL, MOCK_EXPERIMENT_ID, MOCK_EXPERIMENT_NAME),
      ).rejects.toThrow("Unexpected service error");

      // Verify the service was called
      expect(notificationSpy).toHaveBeenCalledOnce();
    });

    it("should pass through all parameters correctly", async () => {
      // Arrange
      const customEmail = "custom@example.com";
      const customExperimentId = "custom-exp-789";
      const customExperimentName = "Custom Experiment";

      const mockResult = success(undefined);
      const notificationSpy = vi
        .spyOn(notificationsService, "sendProjectTransferComplete")
        .mockResolvedValue(mockResult);

      // Act
      await adapter.sendProjectTransferComplete(
        customEmail,
        customExperimentId,
        customExperimentName,
      );

      // Assert
      expect(notificationSpy).toHaveBeenCalledWith(
        customEmail,
        customExperimentId,
        customExperimentName,
      );
    });
  });
});

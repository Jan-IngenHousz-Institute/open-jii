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
  });

  afterAll(async () => {
    await testApp.teardown();
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
    // The `role` argument is the display phrase `describeAccess()` builds, not a role
    // token — the real caller never passes one.
    const MOCK_ACCESS_PHRASE = "a contributor who can view and add data";

    const invitation = {
      resourceType: "experiment",
      resourceId: MOCK_RESOURCE_ID,
      resourceName: MOCK_RESOURCE_NAME,
      actor: MOCK_ACTOR,
      role: MOCK_ACCESS_PHRASE,
      email: "invite@example.com",
    } as const;

    it("should send an email and return success", async () => {
      const notificationSpy = vi
        .spyOn(notificationsService, "sendAccessGrantedNotification")
        .mockResolvedValue(success(undefined));

      const result = await adapter.sendInvitationEmail(invitation);

      assertSuccess(result);
      expect(notificationSpy).toHaveBeenCalledOnce();
      expect(notificationSpy).toHaveBeenCalledWith(invitation);
    });

    it("should return failure when the service fails", async () => {
      const notificationSpy = vi
        .spyOn(notificationsService, "sendAccessGrantedNotification")
        .mockResolvedValue(
          failure({
            name: "InternalError",
            code: "INTERNAL_ERROR",
            message: "Email service failed",
            statusCode: 500,
          }),
        );

      const result = await adapter.sendInvitationEmail(invitation);

      assertFailure(result);
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toBe("Email service failed");
      expect(notificationSpy).toHaveBeenCalledOnce();
    });

    it("should propagate an exception from the service", async () => {
      const notificationSpy = vi
        .spyOn(notificationsService, "sendAccessGrantedNotification")
        .mockRejectedValue(new Error("Unexpected service error"));

      await expect(adapter.sendInvitationEmail(invitation)).rejects.toThrow(
        "Unexpected service error",
      );
      expect(notificationSpy).toHaveBeenCalledOnce();
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

  describe("sendOrganizationInvitationNotification", () => {
    it("delegates to NotificationsService with every argument in order", async () => {
      const notificationSpy = vi
        .spyOn(notificationsService, "sendOrganizationInvitationNotification")
        .mockResolvedValue(success(undefined));

      const result = await adapter.sendOrganizationInvitationNotification(
        "org-123",
        "Photosynthesis Lab",
        "Ada Lovelace",
        "member",
        "invitee@example.com",
      );

      assertSuccess(result);
      expect(notificationSpy).toHaveBeenCalledExactlyOnceWith(
        "org-123",
        "Photosynthesis Lab",
        "Ada Lovelace",
        "member",
        "invitee@example.com",
      );
    });
  });
});

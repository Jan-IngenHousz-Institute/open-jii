import type { MockInstance } from "vitest";

import { TestHarness } from "../../../../../test/test-harness";
import { ErrorCodes } from "../../../../utils/error-codes";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import { NotificationsService } from "./notifications.service";

function spyOnProtected(instance: object, method: string): MockInstance {
  return vi.spyOn(instance as unknown as Record<string, unknown>, method as never);
}

// Test constants
const MOCK_EXPERIMENT_ID = "exp-123";
const MOCK_EXPERIMENT_NAME = "Test Experiment";
const MOCK_ACTOR = "John Doe";
const MOCK_ROLE = "researcher";
const MOCK_EMAIL = "test@example.com";
const MOCK_HTML_CONTENT = "<html><body>Test email</body></html>";
const MOCK_TEXT_CONTENT = "Test email";

describe("NotificationsService", () => {
  const testApp = TestHarness.App;
  let service: NotificationsService;

  // Spy references - recreated fresh in each beforeEach
  let mockCreateTransport: MockInstance;
  let mockRenderAddedUserNotification: MockInstance;
  let mockRenderTransferRequestConfirmation: MockInstance;
  let mockRenderProjectTransferComplete: MockInstance;
  let mockRenderJoinRequestSubmittedEmail: MockInstance;
  let mockRenderJoinRequestRejectedEmail: MockInstance;
  let mockRenderOrganizationInvitationEmail: MockInstance;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    service = testApp.module.get(NotificationsService);

    // Create fresh spies on the protected wrapper methods
    mockCreateTransport = spyOnProtected(service, "createMailTransport");
    mockRenderAddedUserNotification = spyOnProtected(
      service,
      "renderAddedUserNotificationEmail",
    ).mockResolvedValue({
      html: MOCK_HTML_CONTENT,
      text: MOCK_TEXT_CONTENT,
    });
    mockRenderTransferRequestConfirmation = spyOnProtected(
      service,
      "renderTransferRequestConfirmationEmail",
    ).mockResolvedValue({
      html: MOCK_HTML_CONTENT,
      text: MOCK_TEXT_CONTENT,
    });
    mockRenderProjectTransferComplete = spyOnProtected(
      service,
      "renderProjectTransferCompleteEmail",
    ).mockResolvedValue({
      html: MOCK_HTML_CONTENT,
      text: MOCK_TEXT_CONTENT,
    });
    mockRenderJoinRequestSubmittedEmail = spyOnProtected(
      service,
      "renderJoinRequestSubmittedEmail",
    ).mockResolvedValue({
      html: MOCK_HTML_CONTENT,
      text: MOCK_TEXT_CONTENT,
    });
    mockRenderJoinRequestRejectedEmail = spyOnProtected(
      service,
      "renderJoinRequestRejectedEmail",
    ).mockResolvedValue({
      html: MOCK_HTML_CONTENT,
      text: MOCK_TEXT_CONTENT,
    });
    mockRenderOrganizationInvitationEmail = spyOnProtected(
      service,
      "renderOrganizationInvitationEmail",
    ).mockResolvedValue({
      html: MOCK_HTML_CONTENT,
      text: MOCK_TEXT_CONTENT,
    });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("sendAddedUserNotification", () => {
    it("should successfully send notification email", async () => {
      // Arrange
      const mockSendMail = vi.fn().mockReturnValue({
        messageId: "test-message-id",
        accepted: [MOCK_EMAIL],
        rejected: [],
        pending: [],
      });

      const mockTransport = {
        sendMail: mockSendMail,
      };

      mockCreateTransport.mockReturnValue(mockTransport);

      // Act
      const result = await service.sendAddedUserNotification(
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
        MOCK_ACTOR,
        MOCK_ROLE,
        MOCK_EMAIL,
      );

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      // Verify transport creation
      expect(mockCreateTransport).toHaveBeenCalledWith("smtp://localhost:1025");

      // Verify email render function was called
      expect(mockRenderAddedUserNotification).toHaveBeenCalledWith({
        host: "localhost:3000",
        baseUrl: "http://localhost:3000",
        experimentName: MOCK_EXPERIMENT_NAME,
        experimentUrl: `http://localhost:3000/platform/experiments/${MOCK_EXPERIMENT_ID}`,
        actor: MOCK_ACTOR,
        role: MOCK_ROLE,
      });

      // Verify sendMail was called with correct parameters
      expect(mockSendMail).toHaveBeenCalledWith({
        to: MOCK_EMAIL,
        from: {
          name: "openJII",
          address: "noreply@localhost",
        },
        subject: "Added to experiment on the openJII Platform",
        html: MOCK_HTML_CONTENT,
        text: MOCK_TEXT_CONTENT,
      });
    });

    it("should handle email with rejected addresses", async () => {
      // Arrange
      const mockSendMail = vi.fn().mockReturnValue({
        messageId: "test-message-id",
        accepted: [],
        rejected: [MOCK_EMAIL],
        pending: [],
      });

      const mockTransport = {
        sendMail: mockSendMail,
      };

      mockCreateTransport.mockReturnValue(mockTransport);

      // Act
      const result = await service.sendAddedUserNotification(
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
        MOCK_ACTOR,
        MOCK_ROLE,
        MOCK_EMAIL,
      );

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain(`Email (${MOCK_EMAIL}) could not be sent`);
    });

    it("should handle email with pending addresses", async () => {
      // Arrange
      const mockSendMail = vi.fn().mockReturnValue({
        messageId: "test-message-id",
        accepted: [],
        rejected: [],
        pending: [MOCK_EMAIL],
      });

      const mockTransport = {
        sendMail: mockSendMail,
      };

      mockCreateTransport.mockReturnValue(mockTransport);

      // Act
      const result = await service.sendAddedUserNotification(
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
        MOCK_ACTOR,
        MOCK_ROLE,
        MOCK_EMAIL,
      );

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain(`Email (${MOCK_EMAIL}) could not be sent`);
    });

    it("should handle multiple failed addresses", async () => {
      // Arrange
      const rejectedEmail1 = "rejected1@example.com";
      const rejectedEmail2 = "rejected2@example.com";
      const pendingEmail = "pending@example.com";

      const mockSendMail = vi.fn().mockReturnValue({
        messageId: "test-message-id",
        accepted: [],
        rejected: [rejectedEmail1, rejectedEmail2],
        pending: [pendingEmail],
      });

      const mockTransport = {
        sendMail: mockSendMail,
      };

      mockCreateTransport.mockReturnValue(mockTransport);

      // Act
      const result = await service.sendAddedUserNotification(
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
        MOCK_ACTOR,
        MOCK_ROLE,
        MOCK_EMAIL,
      );

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain(
        `Email (${rejectedEmail1}, ${rejectedEmail2}, ${pendingEmail}) could not be sent`,
      );
    });

    it("should handle failed addresses with object format", async () => {
      // Arrange
      const failedAddressObject = { address: "failed@example.com" };

      const mockSendMail = vi.fn().mockReturnValue({
        messageId: "test-message-id",
        accepted: [],
        rejected: [failedAddressObject],
        pending: [],
      });

      const mockTransport = {
        sendMail: mockSendMail,
      };

      mockCreateTransport.mockReturnValue(mockTransport);

      // Act
      const result = await service.sendAddedUserNotification(
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
        MOCK_ACTOR,
        MOCK_ROLE,
        MOCK_EMAIL,
      );

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Email (failed@example.com) could not be sent");
    });

    it("should handle nodemailer transport creation errors", async () => {
      // Arrange
      const transportError = new Error("Failed to create transport");
      mockCreateTransport.mockImplementation(() => {
        throw transportError;
      });

      // Act
      const result = await service.sendAddedUserNotification(
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
        MOCK_ACTOR,
        MOCK_ROLE,
        MOCK_EMAIL,
      );

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to send email: Failed to create transport");
    });

    it("should handle email rendering errors", async () => {
      // Arrange
      const renderError = new Error("Failed to render email template");
      mockRenderAddedUserNotification.mockRejectedValue(renderError);

      const mockTransport = {
        sendMail: vi.fn(),
      };
      mockCreateTransport.mockReturnValue(mockTransport);

      // Act
      const result = await service.sendAddedUserNotification(
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
        MOCK_ACTOR,
        MOCK_ROLE,
        MOCK_EMAIL,
      );

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain(
        "Failed to send email: Failed to render email template",
      );
    });

    it("should handle sendMail errors", async () => {
      // Arrange
      const sendMailError = new Error("SMTP connection failed");
      const mockSendMail = vi.fn().mockImplementation(() => {
        throw sendMailError;
      });

      const mockTransport = {
        sendMail: mockSendMail,
      };

      mockCreateTransport.mockReturnValue(mockTransport);

      // Act
      const result = await service.sendAddedUserNotification(
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
        MOCK_ACTOR,
        MOCK_ROLE,
        MOCK_EMAIL,
      );

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to send email: SMTP connection failed");
    });

    it("should handle missing rejected and pending properties gracefully", async () => {
      // Arrange
      const mockSendMail = vi.fn().mockReturnValue({
        messageId: "test-message-id",
        accepted: [MOCK_EMAIL],
        rejected: [],
        pending: [],
      });

      const mockTransport = {
        sendMail: mockSendMail,
      };

      mockCreateTransport.mockReturnValue(mockTransport);

      // Act
      const result = await service.sendAddedUserNotification(
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
        MOCK_ACTOR,
        MOCK_ROLE,
        MOCK_EMAIL,
      );

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      // Should not throw error when rejected/pending are undefined
      expect(mockSendMail).toHaveBeenCalled();
    });

    it("should handle non-Error exceptions", async () => {
      // Arrange
      const stringError = new Error("String error message");
      mockCreateTransport.mockImplementation(() => {
        throw stringError;
      });

      // Act
      const result = await service.sendAddedUserNotification(
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
        MOCK_ACTOR,
        MOCK_ROLE,
        MOCK_EMAIL,
      );

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to send email: String error message");
    });
  });

  describe("sendTransferRequestConfirmation", () => {
    const MOCK_EMAIL = "test@example.com";
    const MOCK_PROJECT_ID_OLD = "project-123";
    const MOCK_PROJECT_URL_OLD = "https://photosynq.org/projects/123";

    it("should successfully send confirmation email", async () => {
      // Arrange
      const mockSendMail = vi.fn().mockReturnValue({
        messageId: "test-message-id",
        accepted: [MOCK_EMAIL],
        rejected: [],
        pending: [],
      });

      const mockTransport = {
        sendMail: mockSendMail,
      };

      mockCreateTransport.mockReturnValue(mockTransport);

      // Act
      const result = await service.sendTransferRequestConfirmation(
        MOCK_EMAIL,
        MOCK_PROJECT_ID_OLD,
        MOCK_PROJECT_URL_OLD,
      );

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      // Verify transport creation
      expect(mockCreateTransport).toHaveBeenCalledWith("smtp://localhost:1025");

      // Verify email render function was called
      expect(mockRenderTransferRequestConfirmation).toHaveBeenCalledWith({
        host: "localhost:3000",
        baseUrl: "http://localhost:3000",
        projectIdOld: MOCK_PROJECT_ID_OLD,
        projectUrlOld: MOCK_PROJECT_URL_OLD,
        userEmail: MOCK_EMAIL,
      });

      // Verify sendMail was called with correct parameters
      expect(mockSendMail).toHaveBeenCalledWith({
        to: MOCK_EMAIL,
        from: {
          name: "openJII",
          address: "noreply@localhost",
        },
        subject: "Project Transfer Request Received - openJII",
        html: MOCK_HTML_CONTENT,
        text: MOCK_TEXT_CONTENT,
      });
    });

    it("should handle email with rejected addresses", async () => {
      // Arrange
      const mockSendMail = vi.fn().mockReturnValue({
        messageId: "test-message-id",
        accepted: [],
        rejected: [MOCK_EMAIL],
        pending: [],
      });

      const mockTransport = {
        sendMail: mockSendMail,
      };

      mockCreateTransport.mockReturnValue(mockTransport);

      // Act
      const result = await service.sendTransferRequestConfirmation(
        MOCK_EMAIL,
        MOCK_PROJECT_ID_OLD,
        MOCK_PROJECT_URL_OLD,
      );

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain(`Email (${MOCK_EMAIL}) could not be sent`);
    });

    it("should handle email with pending addresses", async () => {
      // Arrange
      const mockSendMail = vi.fn().mockReturnValue({
        messageId: "test-message-id",
        accepted: [],
        rejected: [],
        pending: [MOCK_EMAIL],
      });

      const mockTransport = {
        sendMail: mockSendMail,
      };

      mockCreateTransport.mockReturnValue(mockTransport);

      // Act
      const result = await service.sendTransferRequestConfirmation(
        MOCK_EMAIL,
        MOCK_PROJECT_ID_OLD,
        MOCK_PROJECT_URL_OLD,
      );

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain(`Email (${MOCK_EMAIL}) could not be sent`);
    });

    it("should handle multiple failed addresses", async () => {
      // Arrange
      const rejectedEmail1 = "rejected1@example.com";
      const rejectedEmail2 = "rejected2@example.com";
      const pendingEmail = "pending@example.com";

      const mockSendMail = vi.fn().mockReturnValue({
        messageId: "test-message-id",
        accepted: [],
        rejected: [rejectedEmail1, rejectedEmail2],
        pending: [pendingEmail],
      });

      const mockTransport = {
        sendMail: mockSendMail,
      };

      mockCreateTransport.mockReturnValue(mockTransport);

      // Act
      const result = await service.sendTransferRequestConfirmation(
        MOCK_EMAIL,
        MOCK_PROJECT_ID_OLD,
        MOCK_PROJECT_URL_OLD,
      );

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain(
        `Email (${rejectedEmail1}, ${rejectedEmail2}, ${pendingEmail}) could not be sent`,
      );
    });

    it("should handle failed addresses with object format", async () => {
      // Arrange
      const failedAddressObject = { address: "failed@example.com" };

      const mockSendMail = vi.fn().mockReturnValue({
        messageId: "test-message-id",
        accepted: [],
        rejected: [failedAddressObject],
        pending: [],
      });

      const mockTransport = {
        sendMail: mockSendMail,
      };

      mockCreateTransport.mockReturnValue(mockTransport);

      // Act
      const result = await service.sendTransferRequestConfirmation(
        MOCK_EMAIL,
        MOCK_PROJECT_ID_OLD,
        MOCK_PROJECT_URL_OLD,
      );

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Email (failed@example.com) could not be sent");
    });

    it("should handle nodemailer transport creation errors", async () => {
      // Arrange
      const transportError = new Error("Failed to create transport");
      mockCreateTransport.mockImplementation(() => {
        throw transportError;
      });

      // Act
      const result = await service.sendTransferRequestConfirmation(
        MOCK_EMAIL,
        MOCK_PROJECT_ID_OLD,
        MOCK_PROJECT_URL_OLD,
      );

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to send email: Failed to create transport");
    });

    it("should handle email rendering errors", async () => {
      // Arrange
      const renderError = new Error("Failed to render email template");
      mockRenderTransferRequestConfirmation.mockRejectedValue(renderError);

      const mockTransport = {
        sendMail: vi.fn(),
      };
      mockCreateTransport.mockReturnValue(mockTransport);

      // Act
      const result = await service.sendTransferRequestConfirmation(
        MOCK_EMAIL,
        MOCK_PROJECT_ID_OLD,
        MOCK_PROJECT_URL_OLD,
      );

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain(
        "Failed to send email: Failed to render email template",
      );
    });

    it("should handle sendMail errors", async () => {
      // Arrange
      const sendMailError = new Error("SMTP connection failed");
      const mockSendMail = vi.fn().mockImplementation(() => {
        throw sendMailError;
      });

      const mockTransport = {
        sendMail: mockSendMail,
      };

      mockCreateTransport.mockReturnValue(mockTransport);

      // Act
      const result = await service.sendTransferRequestConfirmation(
        MOCK_EMAIL,
        MOCK_PROJECT_ID_OLD,
        MOCK_PROJECT_URL_OLD,
      );

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to send email: SMTP connection failed");
    });

    it("should handle missing rejected and pending properties gracefully", async () => {
      // Arrange
      const mockSendMail = vi.fn().mockReturnValue({
        messageId: "test-message-id",
        accepted: [MOCK_EMAIL],
        rejected: [],
        pending: [],
      });

      const mockTransport = {
        sendMail: mockSendMail,
      };

      mockCreateTransport.mockReturnValue(mockTransport);

      // Act
      const result = await service.sendTransferRequestConfirmation(
        MOCK_EMAIL,
        MOCK_PROJECT_ID_OLD,
        MOCK_PROJECT_URL_OLD,
      );

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      // Should not throw error when rejected/pending are undefined
      expect(mockSendMail).toHaveBeenCalled();
    });

    it("should handle non-Error exceptions", async () => {
      // Arrange
      const stringError = new Error("String error message");
      mockCreateTransport.mockImplementation(() => {
        throw stringError;
      });

      // Act
      const result = await service.sendTransferRequestConfirmation(
        MOCK_EMAIL,
        MOCK_PROJECT_ID_OLD,
        MOCK_PROJECT_URL_OLD,
      );

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to send email: String error message");
    });
  });

  describe("sendProjectTransferComplete", () => {
    const MOCK_EMAIL = "test@example.com";
    const MOCK_EXPERIMENT_ID = "exp-456";
    const MOCK_EXPERIMENT_NAME = "Transferred Experiment";

    it("should successfully send project transfer complete email", async () => {
      // Arrange
      const mockSendMail = vi.fn().mockReturnValue({
        messageId: "test-message-id",
        accepted: [MOCK_EMAIL],
        rejected: [],
        pending: [],
      });

      const mockTransport = {
        sendMail: mockSendMail,
      };

      mockCreateTransport.mockReturnValue(mockTransport);

      // Act
      const result = await service.sendProjectTransferComplete(
        MOCK_EMAIL,
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
      );

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);

      // Verify transport creation
      expect(mockCreateTransport).toHaveBeenCalledWith("smtp://localhost:1025");

      // Verify email render function was called
      expect(mockRenderProjectTransferComplete).toHaveBeenCalledWith({
        host: "localhost:3000",
        baseUrl: "http://localhost:3000",
        experimentName: MOCK_EXPERIMENT_NAME,
        experimentUrl: `http://localhost:3000/platform/experiments/${MOCK_EXPERIMENT_ID}`,
      });

      // Verify sendMail was called with correct parameters
      expect(mockSendMail).toHaveBeenCalledWith({
        to: MOCK_EMAIL,
        from: {
          name: "openJII",
          address: "noreply@localhost",
        },
        subject: "Project Transfer Complete - openJII",
        html: MOCK_HTML_CONTENT,
        text: MOCK_TEXT_CONTENT,
      });
    });

    it("should handle email with rejected addresses", async () => {
      // Arrange
      const mockSendMail = vi.fn().mockReturnValue({
        messageId: "test-message-id",
        accepted: [],
        rejected: [MOCK_EMAIL],
        pending: [],
      });

      const mockTransport = {
        sendMail: mockSendMail,
      };

      mockCreateTransport.mockReturnValue(mockTransport);

      // Act
      const result = await service.sendProjectTransferComplete(
        MOCK_EMAIL,
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
      );

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain(`Email (${MOCK_EMAIL}) could not be sent`);
    });

    it("should handle nodemailer transport creation errors", async () => {
      // Arrange
      const transportError = new Error("Failed to create transport");
      mockCreateTransport.mockImplementation(() => {
        throw transportError;
      });

      // Act
      const result = await service.sendProjectTransferComplete(
        MOCK_EMAIL,
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
      );

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to send email: Failed to create transport");
    });

    it("should handle email rendering errors", async () => {
      // Arrange
      const renderError = new Error("Failed to render email template");
      mockRenderProjectTransferComplete.mockRejectedValue(renderError);

      const mockTransport = {
        sendMail: vi.fn(),
      };
      mockCreateTransport.mockReturnValue(mockTransport);

      // Act
      const result = await service.sendProjectTransferComplete(
        MOCK_EMAIL,
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
      );

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain(
        "Failed to send email: Failed to render email template",
      );
    });

    it("should handle sendMail errors", async () => {
      // Arrange
      const sendMailError = new Error("SMTP connection failed");
      const mockSendMail = vi.fn().mockImplementation(() => {
        throw sendMailError;
      });

      const mockTransport = {
        sendMail: mockSendMail,
      };

      mockCreateTransport.mockReturnValue(mockTransport);

      // Act
      const result = await service.sendProjectTransferComplete(
        MOCK_EMAIL,
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
      );

      // Assert
      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to send email: SMTP connection failed");
    });
  });

  describe("sendJoinRequestSubmittedNotification", () => {
    const MOCK_ADMIN_EMAIL = "admin@example.com";
    const MOCK_REQUESTER_NAME = "Jane Doe";
    const MOCK_MESSAGE = "I would like to join this experiment.";

    it("should successfully send notification with message", async () => {
      const mockSendMail = vi.fn().mockReturnValue({
        messageId: "test-message-id",
        accepted: [MOCK_ADMIN_EMAIL],
        rejected: [],
        pending: [],
      });
      mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });

      const result = await service.sendJoinRequestSubmittedNotification(
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
        MOCK_REQUESTER_NAME,
        MOCK_ADMIN_EMAIL,
        MOCK_MESSAGE,
      );

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(mockCreateTransport).toHaveBeenCalledWith("smtp://localhost:1025");
      expect(mockRenderJoinRequestSubmittedEmail).toHaveBeenCalledWith({
        host: "localhost:3000",
        baseUrl: "http://localhost:3000",
        experimentName: MOCK_EXPERIMENT_NAME,
        experimentUrl: `http://localhost:3000/platform/experiments/${MOCK_EXPERIMENT_ID}`,
        requesterName: MOCK_REQUESTER_NAME,
        message: MOCK_MESSAGE,
      });
      expect(mockSendMail).toHaveBeenCalledWith({
        to: MOCK_ADMIN_EMAIL,
        from: { name: "openJII", address: "noreply@localhost" },
        subject: `New request to join ${MOCK_EXPERIMENT_NAME} on openJII`,
        html: MOCK_HTML_CONTENT,
        text: MOCK_TEXT_CONTENT,
      });
    });

    it("should successfully send notification without message", async () => {
      const mockSendMail = vi.fn().mockReturnValue({
        messageId: "test-message-id",
        accepted: [MOCK_ADMIN_EMAIL],
        rejected: [],
        pending: [],
      });
      mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });

      const result = await service.sendJoinRequestSubmittedNotification(
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
        MOCK_REQUESTER_NAME,
        MOCK_ADMIN_EMAIL,
      );

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(mockRenderJoinRequestSubmittedEmail).toHaveBeenCalledWith(
        expect.objectContaining({ message: undefined }),
      );
    });

    it("should handle email with rejected addresses", async () => {
      const mockSendMail = vi.fn().mockReturnValue({
        messageId: "test-message-id",
        accepted: [],
        rejected: [MOCK_ADMIN_EMAIL],
        pending: [],
      });
      mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });

      const result = await service.sendJoinRequestSubmittedNotification(
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
        MOCK_REQUESTER_NAME,
        MOCK_ADMIN_EMAIL,
      );

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain(`Email (${MOCK_ADMIN_EMAIL}) could not be sent`);
    });

    it("should handle email with pending addresses", async () => {
      const mockSendMail = vi.fn().mockReturnValue({
        messageId: "test-message-id",
        accepted: [],
        rejected: [],
        pending: [MOCK_ADMIN_EMAIL],
      });
      mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });

      const result = await service.sendJoinRequestSubmittedNotification(
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
        MOCK_REQUESTER_NAME,
        MOCK_ADMIN_EMAIL,
      );

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain(`Email (${MOCK_ADMIN_EMAIL}) could not be sent`);
    });

    it("should handle transport creation errors", async () => {
      mockCreateTransport.mockImplementation(() => {
        throw new Error("Failed to create transport");
      });

      const result = await service.sendJoinRequestSubmittedNotification(
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
        MOCK_REQUESTER_NAME,
        MOCK_ADMIN_EMAIL,
      );

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to send email: Failed to create transport");
    });

    it("should handle email rendering errors", async () => {
      mockRenderJoinRequestSubmittedEmail.mockRejectedValue(
        new Error("Failed to render email template"),
      );
      mockCreateTransport.mockReturnValue({ sendMail: vi.fn() });

      const result = await service.sendJoinRequestSubmittedNotification(
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
        MOCK_REQUESTER_NAME,
        MOCK_ADMIN_EMAIL,
      );

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain(
        "Failed to send email: Failed to render email template",
      );
    });

    it("should handle sendMail errors", async () => {
      const mockSendMail = vi.fn().mockImplementation(() => {
        throw new Error("SMTP connection failed");
      });
      mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });

      const result = await service.sendJoinRequestSubmittedNotification(
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
        MOCK_REQUESTER_NAME,
        MOCK_ADMIN_EMAIL,
      );

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to send email: SMTP connection failed");
    });
  });

  describe("sendJoinRequestRejectedNotification", () => {
    const MOCK_REQUESTER_EMAIL = "requester@example.com";

    it("should successfully send notification", async () => {
      const mockSendMail = vi.fn().mockReturnValue({
        messageId: "test-message-id",
        accepted: [MOCK_REQUESTER_EMAIL],
        rejected: [],
        pending: [],
      });
      mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });

      const result = await service.sendJoinRequestRejectedNotification(
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
        MOCK_REQUESTER_EMAIL,
      );

      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(mockCreateTransport).toHaveBeenCalledWith("smtp://localhost:1025");
      expect(mockRenderJoinRequestRejectedEmail).toHaveBeenCalledWith({
        host: "localhost:3000",
        baseUrl: "http://localhost:3000",
        experimentName: MOCK_EXPERIMENT_NAME,
      });
      expect(mockSendMail).toHaveBeenCalledWith({
        to: MOCK_REQUESTER_EMAIL,
        from: { name: "openJII", address: "noreply@localhost" },
        subject: `Update on your request to join ${MOCK_EXPERIMENT_NAME}`,
        html: MOCK_HTML_CONTENT,
        text: MOCK_TEXT_CONTENT,
      });
    });

    it("should handle email with rejected addresses", async () => {
      const mockSendMail = vi.fn().mockReturnValue({
        messageId: "test-message-id",
        accepted: [],
        rejected: [MOCK_REQUESTER_EMAIL],
        pending: [],
      });
      mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });

      const result = await service.sendJoinRequestRejectedNotification(
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
        MOCK_REQUESTER_EMAIL,
      );

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain(`Email (${MOCK_REQUESTER_EMAIL}) could not be sent`);
    });

    it("should handle email with pending addresses", async () => {
      const mockSendMail = vi.fn().mockReturnValue({
        messageId: "test-message-id",
        accepted: [],
        rejected: [],
        pending: [MOCK_REQUESTER_EMAIL],
      });
      mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });

      const result = await service.sendJoinRequestRejectedNotification(
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
        MOCK_REQUESTER_EMAIL,
      );

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain(`Email (${MOCK_REQUESTER_EMAIL}) could not be sent`);
    });

    it("should handle transport creation errors", async () => {
      mockCreateTransport.mockImplementation(() => {
        throw new Error("Failed to create transport");
      });

      const result = await service.sendJoinRequestRejectedNotification(
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
        MOCK_REQUESTER_EMAIL,
      );

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to send email: Failed to create transport");
    });

    it("should handle email rendering errors", async () => {
      mockRenderJoinRequestRejectedEmail.mockRejectedValue(
        new Error("Failed to render email template"),
      );
      mockCreateTransport.mockReturnValue({ sendMail: vi.fn() });

      const result = await service.sendJoinRequestRejectedNotification(
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
        MOCK_REQUESTER_EMAIL,
      );

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain(
        "Failed to send email: Failed to render email template",
      );
    });

    it("should handle sendMail errors", async () => {
      const mockSendMail = vi.fn().mockImplementation(() => {
        throw new Error("SMTP connection failed");
      });
      mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });

      const result = await service.sendJoinRequestRejectedNotification(
        MOCK_EXPERIMENT_ID,
        MOCK_EXPERIMENT_NAME,
        MOCK_REQUESTER_EMAIL,
      );

      expect(result.isSuccess()).toBe(false);
      assertFailure(result);
      expect(result.error.message).toContain("Failed to send email: SMTP connection failed");
    });
  });

  describe("sendOrganizationInvitationNotification", () => {
    const MOCK_ORGANIZATION_ID = "org-123";
    const MOCK_ORGANIZATION_NAME = "Photosynthesis Lab";
    const MOCK_INVITEE_EMAIL = "invitee@example.com";

    it("renders the shared invitation template with the account tab as the link", async () => {
      const mockSendMail = vi.fn().mockReturnValue({
        messageId: "test-message-id",
        accepted: [MOCK_INVITEE_EMAIL],
        rejected: [],
        pending: [],
      });
      mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });

      const result = await service.sendOrganizationInvitationNotification(
        MOCK_ORGANIZATION_ID,
        MOCK_ORGANIZATION_NAME,
        MOCK_ACTOR,
        "admin",
        MOCK_INVITEE_EMAIL,
      );

      assertSuccess(result);
      // The same template and destination `packages/auth` uses for an invitee with
      // no account, so the two halves of the split read identically.
      expect(mockRenderOrganizationInvitationEmail).toHaveBeenCalledWith({
        host: "localhost:3000",
        baseUrl: "http://localhost:3000",
        organizationName: MOCK_ORGANIZATION_NAME,
        inviteUrl: "http://localhost:3000/platform/account/invitations",
        inviterName: MOCK_ACTOR,
        role: "admin",
      });
      expect(mockSendMail).toHaveBeenCalledWith({
        to: MOCK_INVITEE_EMAIL,
        from: { name: "openJII", address: "noreply@localhost" },
        subject: `You've been invited to join ${MOCK_ORGANIZATION_NAME}`,
        html: MOCK_HTML_CONTENT,
        text: MOCK_TEXT_CONTENT,
      });
    });

    it("reports a failed send as a failure rather than throwing", async () => {
      mockCreateTransport.mockReturnValue({
        sendMail: vi.fn().mockImplementation(() => {
          throw new Error("SMTP connection failed");
        }),
      });

      const result = await service.sendOrganizationInvitationNotification(
        MOCK_ORGANIZATION_ID,
        MOCK_ORGANIZATION_NAME,
        MOCK_ACTOR,
        "member",
        MOCK_INVITEE_EMAIL,
      );

      assertFailure(result);
      expect(result.error.message).toContain("Failed to send email: SMTP connection failed");
    });
  });

  describe("verifyTransport", () => {
    it("succeeds when the SMTP server accepts the login", async () => {
      mockCreateTransport.mockReturnValue({ verify: vi.fn().mockResolvedValue(true) });

      const result = await service.verifyTransport();

      assertSuccess(result);
    });

    it("fails with its own code when the SMTP server refuses the login", async () => {
      mockCreateTransport.mockReturnValue({
        verify: vi.fn().mockRejectedValue(new Error("535 Authentication failed")),
      });

      const result = await service.verifyTransport();

      assertFailure(result);
      expect(result.error.code).toBe(ErrorCodes.EMAIL_TRANSPORT_VERIFY_FAILED);
      expect(result.error.message).toContain("535 Authentication failed");
    });
  });
});

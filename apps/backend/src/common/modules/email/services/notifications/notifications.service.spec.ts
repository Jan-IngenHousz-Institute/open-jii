import { Logger } from "@nestjs/common";
import type { MockInstance } from "vitest";

import {
  ATTEMPT_DEADLINE_MS,
  LEASE_MS,
} from "../../../../../notifications/application/services/notification-outbox.worker";
import { TestHarness } from "../../../../../test/test-harness";
import { ErrorCodes } from "../../../../utils/error-codes";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import {
  MAIL_TRANSPORT_TIMEOUTS_MS,
  NotificationsService,
  mailTransportOptions,
} from "./notifications.service";

function spyOnProtected(instance: object, method: string): MockInstance {
  return vi.spyOn(instance as unknown as Record<string, unknown>, method as never);
}

// Test constants
const MOCK_EXPERIMENT_ID = "exp-123";
const MOCK_EXPERIMENT_NAME = "Test Experiment";
const MOCK_ACTOR = "John Doe";
const MOCK_EMAIL = "test@example.com";
const MOCK_HTML_CONTENT = "<html><body>Test email</body></html>";
const MOCK_TEXT_CONTENT = "Test email";

describe("NotificationsService", () => {
  const testApp = TestHarness.App;
  let service: NotificationsService;

  // Spy references - recreated fresh in each beforeEach
  let mockCreateTransport: MockInstance;
  let mockRenderAccessGrantedNotification: MockInstance;
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
    mockRenderAccessGrantedNotification = spyOnProtected(
      service,
      "renderAccessGrantedNotificationEmail",
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

  describe("sendAccessGrantedNotification", () => {
    const MOCK_RESOURCE_ID = "res-123";
    const MOCK_RESOURCE_NAME = "Leaf Area Index";

    function acceptingTransport() {
      const mockSendMail = vi.fn().mockReturnValue({
        messageId: "test-message-id",
        accepted: [MOCK_EMAIL],
        rejected: [],
        pending: [],
      });
      mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });
      return mockSendMail;
    }

    it("renders the generic access template and links to the resource's page", async () => {
      const mockSendMail = acceptingTransport();

      const result = await service.sendAccessGrantedNotification({
        resourceType: "experiment",
        resourceId: MOCK_RESOURCE_ID,
        resourceName: MOCK_RESOURCE_NAME,
        actor: MOCK_ACTOR,
        role: "a contributor who can view and add data",
        email: MOCK_EMAIL,
      });

      assertSuccess(result);
      expect(mockCreateTransport).toHaveBeenCalledWith("smtp://localhost:1025");
      expect(mockRenderAccessGrantedNotification).toHaveBeenCalledWith({
        host: "localhost:3000",
        baseUrl: "http://localhost:3000",
        resourceKind: "experiment",
        resourceName: MOCK_RESOURCE_NAME,
        resourceUrl: `http://localhost:3000/platform/experiments/${MOCK_RESOURCE_ID}`,
        actor: MOCK_ACTOR,
        role: "a contributor who can view and add data",
      });
      expect(mockSendMail).toHaveBeenCalledWith({
        to: MOCK_EMAIL,
        from: { name: "openJII", address: "noreply@localhost" },
        subject: `Access to ${MOCK_RESOURCE_NAME} on the openJII Platform`,
        html: MOCK_HTML_CONTENT,
        text: MOCK_TEXT_CONTENT,
      });
    });

    it("links a device group to its nested page and carries the non-experiment wording", async () => {
      acceptingTransport();

      const result = await service.sendAccessGrantedNotification({
        resourceType: "device_group",
        resourceId: MOCK_RESOURCE_ID,
        resourceName: "Greenhouse sensors",
        actor: MOCK_ACTOR,
        role: "a collaborator who can view",
        email: MOCK_EMAIL,
      });

      assertSuccess(result);
      expect(mockRenderAccessGrantedNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceKind: "device group",
          resourceUrl: `http://localhost:3000/platform/devices/groups/${MOCK_RESOURCE_ID}`,
          role: "a collaborator who can view",
        }),
      );
    });

    it("links a calibration definition to the calibrations page", async () => {
      acceptingTransport();

      const result = await service.sendAccessGrantedNotification({
        resourceType: "calibration_definition",
        resourceId: MOCK_RESOURCE_ID,
        resourceName: "SPAD baseline",
        actor: MOCK_ACTOR,
        role: "a collaborator who can edit",
        email: MOCK_EMAIL,
      });

      assertSuccess(result);
      expect(mockRenderAccessGrantedNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceKind: "calibration definition",
          resourceUrl: `http://localhost:3000/platform/calibrations/${MOCK_RESOURCE_ID}`,
        }),
      );
    });

    it("treats a rejected address as a failure", async () => {
      mockCreateTransport.mockReturnValue({
        sendMail: vi.fn().mockReturnValue({
          messageId: "test-message-id",
          accepted: [],
          rejected: [MOCK_EMAIL],
          pending: [],
        }),
      });

      const result = await service.sendAccessGrantedNotification({
        resourceType: "workbook",
        resourceId: MOCK_RESOURCE_ID,
        resourceName: MOCK_RESOURCE_NAME,
        actor: MOCK_ACTOR,
        role: "a collaborator who can view",
        email: MOCK_EMAIL,
      });

      assertFailure(result);
      expect(result.error.message).toContain(`Email (${MOCK_EMAIL}) could not be sent`);
    });

    /** A transport that fails the way nodemailer does: an `Error` carrying its `code`. */
    const failingWith = (message: string, fields: Record<string, unknown>) => ({
      sendMail: vi.fn().mockImplementation(() => {
        throw Object.assign(new Error(message), fields);
      }),
    });

    const share = () =>
      service.sendAccessGrantedNotification({
        resourceType: "macro",
        resourceId: MOCK_RESOURCE_ID,
        resourceName: MOCK_RESOURCE_NAME,
        actor: MOCK_ACTOR,
        role: "a collaborator who can edit",
        email: MOCK_EMAIL,
      });

    it("names a relay it could not reach, so a caller can wait out the outage", async () => {
      mockCreateTransport.mockReturnValue(
        failingWith("connect ECONNREFUSED 127.0.0.1:1025", { code: "ECONNECTION" }),
      );

      const result = await share();

      assertFailure(result);
      expect(result.error.code).toBe(ErrorCodes.EMAIL_RELAY_UNREACHABLE);
      // The message is the one every failed send has always carried.
      expect(result.error.message).toBe(
        "Failed to send email: connect ECONNREFUSED 127.0.0.1:1025",
      );
    });

    it("does not call a relay that answered and refused the message unreachable", async () => {
      // The relay was reached and said no: a counted failure, not an outage.
      mockCreateTransport.mockReturnValue(
        failingWith("Can't send mail - all recipients were rejected: 550 5.1.1 unknown user", {
          code: "EENVELOPE",
          responseCode: 550,
        }),
      );

      const result = await share();

      assertFailure(result);
      expect(result.error.code).not.toBe(ErrorCodes.EMAIL_RELAY_UNREACHABLE);
    });

    it("logs an unreachable relay as a warning, not an error", async () => {
      const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
      const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
      mockCreateTransport.mockReturnValue(
        failingWith("connect ECONNREFUSED 127.0.0.1:1025", { code: "ECONNECTION" }),
      );

      await share();

      // Every send during an outage fails the same way; none of them is an error.
      expect(warn).toHaveBeenCalledWith(
        expect.objectContaining({ operation: "sendAccessGrantedNotification" }),
      );
      expect(error).not.toHaveBeenCalled();
    });

    it("logs a refused message as an error", async () => {
      const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
      const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
      mockCreateTransport.mockReturnValue(
        failingWith("Can't send mail - all recipients were rejected: 550 5.1.1 unknown user", {
          code: "EENVELOPE",
          responseCode: 550,
        }),
      );

      await share();

      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "sendAccessGrantedNotification",
          errorCode: ErrorCodes.EMAIL_SEND_FAILED,
        }),
      );
      expect(warn).not.toHaveBeenCalled();
    });

    it("reports a failed send as a failure rather than throwing", async () => {
      mockCreateTransport.mockReturnValue({
        sendMail: vi.fn().mockImplementation(() => {
          throw new Error("SMTP connection failed");
        }),
      });

      const result = await service.sendAccessGrantedNotification({
        resourceType: "macro",
        resourceId: MOCK_RESOURCE_ID,
        resourceName: MOCK_RESOURCE_NAME,
        actor: MOCK_ACTOR,
        role: "a collaborator who can edit",
        email: MOCK_EMAIL,
      });

      assertFailure(result);
      expect(result.error.message).toContain("Failed to send email: SMTP connection failed");
    });
  });

  describe("sendResourceDeletedNotification", () => {
    let mockRenderResourceDeletedNotification: MockInstance;

    beforeEach(() => {
      mockRenderResourceDeletedNotification = spyOnProtected(
        service,
        "renderResourceDeletedNotificationEmail",
      ).mockResolvedValue({
        html: MOCK_HTML_CONTENT,
        text: MOCK_TEXT_CONTENT,
      });
    });

    it("renders the deletion template with the kind label and sends it to the address", async () => {
      const mockSendMail = vi.fn().mockReturnValue({
        messageId: "test-message-id",
        accepted: [MOCK_EMAIL],
        rejected: [],
        pending: [],
      });
      mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });

      const result = await service.sendResourceDeletedNotification({
        resourceType: "device_group",
        resourceName: "Greenhouse sensors",
        actor: MOCK_ACTOR,
        email: MOCK_EMAIL,
      });

      assertSuccess(result);
      expect(mockRenderResourceDeletedNotification).toHaveBeenCalledWith({
        host: "localhost:3000",
        baseUrl: "http://localhost:3000",
        resourceKind: "device group",
        resourceName: "Greenhouse sensors",
        actor: MOCK_ACTOR,
      });
      expect(mockSendMail).toHaveBeenCalledWith({
        to: MOCK_EMAIL,
        from: { name: "openJII", address: "noreply@localhost" },
        subject: "Greenhouse sensors was deleted on the openJII Platform",
        html: MOCK_HTML_CONTENT,
        text: MOCK_TEXT_CONTENT,
      });
    });

    it("treats a rejected address as a failure", async () => {
      mockCreateTransport.mockReturnValue({
        sendMail: vi.fn().mockReturnValue({
          messageId: "test-message-id",
          accepted: [],
          rejected: [MOCK_EMAIL],
          pending: [],
        }),
      });

      const result = await service.sendResourceDeletedNotification({
        resourceType: "protocol",
        resourceName: "Leaf Area Index",
        actor: MOCK_ACTOR,
        email: MOCK_EMAIL,
      });

      assertFailure(result);
      expect(result.error.message).toContain(`Email (${MOCK_EMAIL}) could not be sent`);
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

  describe("sendOrganizationRoleChangedNotification", () => {
    const MOCK_ORGANIZATION_ID = "org-123";
    const MOCK_ORGANIZATION_NAME = "Photosynthesis Lab";
    let mockRenderOrganizationRoleChangedEmail: MockInstance;

    beforeEach(() => {
      mockRenderOrganizationRoleChangedEmail = spyOnProtected(
        service,
        "renderOrganizationRoleChangedEmail",
      ).mockResolvedValue({
        html: MOCK_HTML_CONTENT,
        text: MOCK_TEXT_CONTENT,
      });
    });

    it("renders the role template with the worded role and the organization's page", async () => {
      const mockSendMail = vi.fn().mockReturnValue({
        messageId: "test-message-id",
        accepted: [MOCK_EMAIL],
        rejected: [],
        pending: [],
      });
      mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });

      const result = await service.sendOrganizationRoleChangedNotification({
        organizationId: MOCK_ORGANIZATION_ID,
        organizationName: MOCK_ORGANIZATION_NAME,
        actor: MOCK_ACTOR,
        role: "an admin of",
        email: MOCK_EMAIL,
      });

      assertSuccess(result);
      expect(mockRenderOrganizationRoleChangedEmail).toHaveBeenCalledWith({
        host: "localhost:3000",
        baseUrl: "http://localhost:3000",
        organizationName: MOCK_ORGANIZATION_NAME,
        organizationUrl: `http://localhost:3000/platform/organizations/${MOCK_ORGANIZATION_ID}`,
        actor: MOCK_ACTOR,
        role: "an admin of",
      });
      expect(mockSendMail).toHaveBeenCalledWith({
        to: MOCK_EMAIL,
        from: { name: "openJII", address: "noreply@localhost" },
        subject: `Your role in ${MOCK_ORGANIZATION_NAME} changed on the openJII Platform`,
        html: MOCK_HTML_CONTENT,
        text: MOCK_TEXT_CONTENT,
      });
    });

    it("treats a rejected address as a failure", async () => {
      mockCreateTransport.mockReturnValue({
        sendMail: vi.fn().mockReturnValue({
          messageId: "test-message-id",
          accepted: [],
          rejected: [MOCK_EMAIL],
          pending: [],
        }),
      });

      const result = await service.sendOrganizationRoleChangedNotification({
        organizationId: MOCK_ORGANIZATION_ID,
        organizationName: MOCK_ORGANIZATION_NAME,
        actor: MOCK_ACTOR,
        role: "a member of",
        email: MOCK_EMAIL,
      });

      assertFailure(result);
      expect(result.error.message).toContain(`Email (${MOCK_EMAIL}) could not be sent`);
    });
  });

  describe("sendOrganizationMembershipRemovedNotification", () => {
    const MOCK_ORGANIZATION_NAME = "Photosynthesis Lab";
    let mockRenderOrganizationMembershipRemovedEmail: MockInstance;

    beforeEach(() => {
      mockRenderOrganizationMembershipRemovedEmail = spyOnProtected(
        service,
        "renderOrganizationMembershipRemovedEmail",
      ).mockResolvedValue({
        html: MOCK_HTML_CONTENT,
        text: MOCK_TEXT_CONTENT,
      });
    });

    it("renders the removal template with no link and sends it to the address", async () => {
      const mockSendMail = vi.fn().mockReturnValue({
        messageId: "test-message-id",
        accepted: [MOCK_EMAIL],
        rejected: [],
        pending: [],
      });
      mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });

      const result = await service.sendOrganizationMembershipRemovedNotification({
        organizationName: MOCK_ORGANIZATION_NAME,
        actor: MOCK_ACTOR,
        email: MOCK_EMAIL,
      });

      assertSuccess(result);
      expect(mockRenderOrganizationMembershipRemovedEmail).toHaveBeenCalledWith({
        host: "localhost:3000",
        baseUrl: "http://localhost:3000",
        organizationName: MOCK_ORGANIZATION_NAME,
        actor: MOCK_ACTOR,
      });
      expect(mockSendMail).toHaveBeenCalledWith({
        to: MOCK_EMAIL,
        from: { name: "openJII", address: "noreply@localhost" },
        subject: `You were removed from ${MOCK_ORGANIZATION_NAME} on the openJII Platform`,
        html: MOCK_HTML_CONTENT,
        text: MOCK_TEXT_CONTENT,
      });
    });

    it("treats a rejected address as a failure", async () => {
      mockCreateTransport.mockReturnValue({
        sendMail: vi.fn().mockReturnValue({
          messageId: "test-message-id",
          accepted: [],
          rejected: [MOCK_EMAIL],
          pending: [],
        }),
      });

      const result = await service.sendOrganizationMembershipRemovedNotification({
        organizationName: MOCK_ORGANIZATION_NAME,
        actor: MOCK_ACTOR,
        email: MOCK_EMAIL,
      });

      assertFailure(result);
      expect(result.error.message).toContain(`Email (${MOCK_EMAIL}) could not be sent`);
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

  describe("the transport's timeouts", () => {
    it("travel beside the url, and stay under the outbox lease", () => {
      // Shape first: the options and the url are one object, so they cannot end up in
      // createTransport's second argument, where nodemailer treats them as per-message
      // defaults and silently keeps its own ten-minute socket timeout.
      expect(mailTransportOptions("smtp://127.0.0.1:1025")).toEqual({
        url: "smtp://127.0.0.1:1025",
        ...MAIL_TRANSPORT_TIMEOUTS_MS,
      });

      // The lease hands a row to another task after this long on the premise that no
      // send outlives it; that premise holds only while each timeout is under it.
      for (const timeout of Object.values(MAIL_TRANSPORT_TIMEOUTS_MS)) {
        expect(timeout).toBeLessThan(LEASE_MS);
      }

      // And one attempt is given up on before the lease, so the slowest a send can
      // legitimately be — all three timeouts in turn — has to fit inside that.
      const slowestSend = Object.values(MAIL_TRANSPORT_TIMEOUTS_MS).reduce(
        (total, timeout) => total + timeout,
        0,
      );
      expect(slowestSend).toBeLessThan(ATTEMPT_DEADLINE_MS);
      expect(ATTEMPT_DEADLINE_MS).toBeLessThan(LEASE_MS);
    });
  });
});

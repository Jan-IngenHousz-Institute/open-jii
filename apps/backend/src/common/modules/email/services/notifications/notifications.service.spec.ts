import { render } from "@react-email/components";
import { createTransport } from "nodemailer";

import { TestHarness } from "../../../../../test/test-harness";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import { NotificationsService } from "./notifications.service";

vi.mock("@react-email/components", { spy: true });
vi.mock("nodemailer", { spy: true });

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

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    service = testApp.module.get(NotificationsService);
    vi.clearAllMocks();
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
      vi.mocked(render)
        .mockResolvedValueOnce(MOCK_HTML_CONTENT)
        .mockResolvedValueOnce(MOCK_TEXT_CONTENT);

      const mockSendMail = vi.fn().mockResolvedValue({
        messageId: "test-message-id",
        accepted: [MOCK_EMAIL],
        rejected: [],
        pending: [],
      });

      const mockTransport = {
        sendMail: mockSendMail,
      };

      vi.mocked(createTransport).mockReturnValueOnce(
        mockTransport as Partial<ReturnType<typeof createTransport>> as ReturnType<
          typeof createTransport
        >,
      );

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
      expect(vi.mocked(createTransport)).toHaveBeenCalledWith("smtp://localhost:1025");

      // Verify render was called for both HTML and text versions
      expect(vi.mocked(render)).toHaveBeenCalledTimes(2);
      expect(vi.mocked(render)).toHaveBeenNthCalledWith(1, expect.anything(), {});
      expect(vi.mocked(render)).toHaveBeenNthCalledWith(2, expect.anything(), { plainText: true });

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
      vi.mocked(render)
        .mockResolvedValueOnce(MOCK_HTML_CONTENT)
        .mockResolvedValueOnce(MOCK_TEXT_CONTENT);

      const mockSendMail = vi.fn().mockResolvedValue({
        messageId: "test-message-id",
        accepted: [],
        rejected: [MOCK_EMAIL],
        pending: [],
      });

      const mockTransport = {
        sendMail: mockSendMail,
      };

      vi.mocked(createTransport).mockReturnValueOnce(
        mockTransport as Partial<ReturnType<typeof createTransport>> as ReturnType<
          typeof createTransport
        >,
      );

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
      vi.mocked(render)
        .mockResolvedValueOnce(MOCK_HTML_CONTENT)
        .mockResolvedValueOnce(MOCK_TEXT_CONTENT);

      const mockSendMail = vi.fn().mockResolvedValue({
        messageId: "test-message-id",
        accepted: [],
        rejected: [],
        pending: [MOCK_EMAIL],
      });

      const mockTransport = {
        sendMail: mockSendMail,
      };

      vi.mocked(createTransport).mockReturnValueOnce(
        mockTransport as Partial<ReturnType<typeof createTransport>> as ReturnType<
          typeof createTransport
        >,
      );

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

      const mockSendMail = vi.fn().mockResolvedValue({
        messageId: "test-message-id",
        accepted: [],
        rejected: [rejectedEmail1, rejectedEmail2],
        pending: [pendingEmail],
      });

      vi.mocked(render)
        .mockResolvedValueOnce(MOCK_HTML_CONTENT)
        .mockResolvedValueOnce(MOCK_TEXT_CONTENT);
      vi.mocked(createTransport).mockReturnValueOnce({
        sendMail: mockSendMail,
      } as Partial<ReturnType<typeof createTransport>> as ReturnType<typeof createTransport>);

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
      vi.mocked(render)
        .mockResolvedValueOnce(MOCK_HTML_CONTENT)
        .mockResolvedValueOnce(MOCK_TEXT_CONTENT);

      const failedAddressObject = { address: "failed@example.com" };

      const mockSendMail = vi.fn().mockResolvedValue({
        messageId: "test-message-id",
        accepted: [],
        rejected: [failedAddressObject],
        pending: [],
      });

      vi.mocked(createTransport).mockReturnValueOnce({
        sendMail: mockSendMail,
      } as Partial<ReturnType<typeof createTransport>> as ReturnType<typeof createTransport>);

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
      vi.mocked(createTransport).mockImplementationOnce(() => {
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
      vi.mocked(render).mockRejectedValueOnce(renderError);

      const mockSendMail = vi.fn();
      vi.mocked(createTransport).mockReturnValueOnce({
        sendMail: mockSendMail,
      } as Partial<ReturnType<typeof createTransport>> as ReturnType<typeof createTransport>);

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
      vi.mocked(render)
        .mockResolvedValueOnce(MOCK_HTML_CONTENT)
        .mockResolvedValueOnce(MOCK_TEXT_CONTENT);

      const sendMailError = new Error("SMTP connection failed");
      const mockSendMail = vi.fn().mockRejectedValue(sendMailError);

      vi.mocked(createTransport).mockReturnValueOnce({
        sendMail: mockSendMail,
      } as Partial<ReturnType<typeof createTransport>> as ReturnType<typeof createTransport>);

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
      const mockSendMail = vi.fn().mockResolvedValue({
        messageId: "test-message-id",
        accepted: [MOCK_EMAIL],
        rejected: [],
        pending: [],
      });

      vi.mocked(createTransport).mockReturnValueOnce({
        sendMail: mockSendMail,
      } as Partial<ReturnType<typeof createTransport>> as ReturnType<typeof createTransport>);
      vi.mocked(render)
        .mockResolvedValueOnce(MOCK_HTML_CONTENT)
        .mockResolvedValueOnce(MOCK_TEXT_CONTENT);

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
      vi.mocked(createTransport).mockImplementationOnce(() => {
        throw stringError;
      });
      vi.mocked(render)
        .mockResolvedValueOnce(MOCK_HTML_CONTENT)
        .mockResolvedValueOnce(MOCK_TEXT_CONTENT);

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
});

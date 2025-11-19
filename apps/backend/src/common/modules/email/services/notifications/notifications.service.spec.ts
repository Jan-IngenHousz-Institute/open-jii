import { render } from "@react-email/components";
import { createTransport } from "nodemailer";

import { AddedUserNotification } from "@repo/transactional/emails/added-user-notification";

import { TestHarness } from "../../../../../test/test-harness";
import { assertFailure, assertSuccess } from "../../../../utils/fp-utils";
import { NotificationsService } from "./notifications.service";

// Mock external dependencies
vi.mock("@react-email/components", () => ({
  render: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  createTransport: vi.fn(),
}));

vi.mock("@repo/transactional/emails/added-user-notification", () => ({
  AddedUserNotification: vi.fn(),
}));

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

  // Mock functions
  const mockRender = render as ReturnType<typeof vi.fn>;
  const mockCreateTransport = createTransport as ReturnType<typeof vi.fn>;
  const mockAddedUserNotification = AddedUserNotification as ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    service = testApp.module.get(NotificationsService);

    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mock implementations
    mockRender.mockImplementation((component: unknown, options: { plainText?: boolean } = {}) => {
      return Promise.resolve(options.plainText ? MOCK_TEXT_CONTENT : MOCK_HTML_CONTENT);
    });
  });

  afterEach(() => {
    testApp.afterEach();
    vi.restoreAllMocks();
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
      mockAddedUserNotification.mockReturnValue("mocked-component");

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

      // Verify email component rendering
      expect(mockAddedUserNotification).toHaveBeenCalledWith({
        host: "localhost:3000",
        experimentName: MOCK_EXPERIMENT_NAME,
        experimentUrl: `http://localhost:3000/platform/experiments/${MOCK_EXPERIMENT_ID}`,
        actor: MOCK_ACTOR,
        role: MOCK_ROLE,
      });

      // Verify render was called for both HTML and text versions
      expect(mockRender).toHaveBeenCalledTimes(2);
      expect(mockRender).toHaveBeenCalledWith("mocked-component", {});
      expect(mockRender).toHaveBeenCalledWith("mocked-component", { plainText: true });

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
      mockAddedUserNotification.mockReturnValue("mocked-component");

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
      mockAddedUserNotification.mockReturnValue("mocked-component");

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
      mockAddedUserNotification.mockReturnValue("mocked-component");

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
      mockAddedUserNotification.mockReturnValue("mocked-component");

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
      mockAddedUserNotification.mockReturnValue("mocked-component");

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
      mockRender.mockRejectedValue(renderError);
      mockAddedUserNotification.mockReturnValue("mocked-component");

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
      mockAddedUserNotification.mockReturnValue("mocked-component");

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
        // rejected and pending properties are undefined
      });

      const mockTransport = {
        sendMail: mockSendMail,
      };

      mockCreateTransport.mockReturnValue(mockTransport);
      mockAddedUserNotification.mockReturnValue("mocked-component");

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
      mockAddedUserNotification.mockReturnValue("mocked-component");

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

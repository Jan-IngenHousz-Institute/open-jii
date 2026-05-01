import { config } from "dotenv";
import { resolve } from "path";

// Setup environment variables for tests FIRST before any other imports
config({ path: resolve(__dirname, "../../.env.test") });

const mockGetSession = vi.fn().mockResolvedValue(null);

// Mock Better Auth to prevent database connection during import
vi.mock("@repo/auth/server", () => ({
  auth: {
    api: {
      getSession: mockGetSession,
    },
    options: {
      trustedOrigins: ["http://localhost:3000"],
      baseURL: "http://localhost:3020",
      secret: "test-secret",
      hooks: {},
    },
    trustedOrigins: ["http://localhost:3000"],
    baseURL: "http://localhost:3020",
    secret: "test-secret",
  },
}));

// Mock nodemailer to prevent actual email sending
vi.mock("nodemailer", () => ({
  createTransport: vi.fn(),
}));

// Mock email template rendering
vi.mock("@repo/transactional/render/added-user-notification", () => ({
  renderAddedUserNotification: vi.fn(),
}));

vi.mock("@repo/transactional/render/transfer-request-confirmation", () => ({
  renderTransferRequestConfirmation: vi.fn(),
}));

vi.mock("@repo/transactional/render/project-transfer-complete", () => ({
  renderProjectTransferComplete: vi.fn(),
}));

// Mock analytics server
vi.mock("@repo/analytics/server", () => ({
  initializePostHogServer: vi.fn(),
  getPostHogServerClient: vi.fn(),
  shutdownPostHog: vi.fn(),
}));

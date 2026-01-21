import { config } from "dotenv";
import { resolve } from "path";

// Setup environment variables for tests FIRST before any other imports
config({ path: resolve(__dirname, "../../.env.test") });

// Create a mock function that can be accessed and modified by tests
export const mockGetSession = vi.fn().mockResolvedValue(null);

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
    },
    trustedOrigins: ["http://localhost:3000"],
    baseURL: "http://localhost:3020",
    secret: "test-secret",
  },
}));

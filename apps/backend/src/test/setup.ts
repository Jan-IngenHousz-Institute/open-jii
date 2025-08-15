import { config } from "dotenv";
import { resolve } from "path";
import { vi } from "vitest";

// Setup environment variables for tests
config({ path: resolve(__dirname, "../../.env.test") });

// Setup authentication mock
vi.mock("@repo/auth/express", () => ({
  getSession: vi.fn().mockResolvedValue(null),
}));

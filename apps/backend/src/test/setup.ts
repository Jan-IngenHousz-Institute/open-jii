import { config } from "dotenv";
import { resolve } from "path";

// Setup environment variables for tests
config({ path: resolve(__dirname, "../../.env.test") });

// Setup authentication mock
jest.mock("@repo/auth/express", () => ({
  getSession: jest.fn().mockResolvedValue(null),
}));

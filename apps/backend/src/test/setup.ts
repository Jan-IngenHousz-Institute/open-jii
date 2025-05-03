import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from the test env file first
// This will populate process.env with test values before env validation
config({ path: resolve(__dirname, "../../.env.test") });

// The @repo/env package will automatically validate these values when imported elsewhere

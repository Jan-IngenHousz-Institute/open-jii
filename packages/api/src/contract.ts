import { initContract } from "@ts-rest/core";

import { authContract } from "./contracts/auth.contract";
import { experimentContract } from "./contracts/experiment.contract";

// Initialize the main contract
const c = initContract();

// Export the main API contract
export const contract = c.router({
  experiments: experimentContract,
  auth: authContract,
});

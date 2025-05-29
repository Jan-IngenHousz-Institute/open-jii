import { initContract } from "@ts-rest/core";

import { experimentContract } from "./contracts/experiment.contract";
import { userContract } from "./contracts/user.contract";

// Initialize the main contract
const c = initContract();

// Export the main API contract
export const contract = c.router({
  experiments: experimentContract,
  users: userContract,
});

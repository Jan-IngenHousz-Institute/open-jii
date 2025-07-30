import { initContract } from "@ts-rest/core";

import { experimentContract } from "./contracts/experiment.contract";
import { flowContract } from "./contracts/flow.contract";
import { protocolContract } from "./contracts/protocol.contract";
import { userContract } from "./contracts/user.contract";

// Initialize the main contract
const c = initContract();

// Export the main API contract
export const contract = c.router({
  experiments: experimentContract,
  flows: flowContract,
  protocols: protocolContract,
  users: userContract,
});

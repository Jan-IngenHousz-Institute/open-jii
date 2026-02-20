import { initContract } from "@ts-rest/core";

import { authContract } from "./contracts/auth.contract";
import { experimentContract } from "./contracts/experiment.contract";
import { iotContract } from "./contracts/iot.contract";
import { macroContract } from "./contracts/macro.contract";
import { protocolContract } from "./contracts/protocol.contract";
import { userContract } from "./contracts/user.contract";

// Initialize the main contract
const c = initContract();

// Export the main API contract
export const contract = c.router({
  auth: authContract,
  experiments: experimentContract,
  iot: iotContract,
  macros: macroContract,
  protocols: protocolContract,
  users: userContract,
});

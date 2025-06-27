import { initContract } from "@ts-rest/core";

import { experimentContract } from "./contracts/experiment.contract";
import { protocolContract } from "./contracts/protocol.contract";
import { userContract } from "./contracts/user.contract";
import { webhookContract } from "./contracts/webhook.contract";

// Initialize the main contract
const c = initContract();

// Export the main API contract
export const contract = c.router({
  experiments: experimentContract,
  protocols: protocolContract,
  users: userContract,
  webhooks: webhookContract,
});

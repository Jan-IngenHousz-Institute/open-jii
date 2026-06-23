import { initContract } from "@ts-rest/core";

import { authContract } from "./domains/auth/auth.contract";
import { experimentContract } from "./domains/experiment/experiment.contract";
import { healthContract } from "./domains/health/health.contract";
import { iotContract } from "./domains/iot/iot.contract";
import { macroContract } from "./domains/macro/macro.contract";
import { protocolContract } from "./domains/protocol/protocol.contract";
import { userContract } from "./domains/user/user.contract";
import { workbookContract } from "./domains/workbook/workbook.contract";

// Initialize the main contract
const c = initContract();

// Export the main API contract
export const contract = c.router({
  auth: authContract,
  experiments: experimentContract,
  health: healthContract,
  iot: iotContract,
  macros: macroContract,
  protocols: protocolContract,
  users: userContract,
  workbooks: workbookContract,
});

import { initContract } from "@ts-rest/core";

import { authContract } from "./contracts/auth.contract";
import { experimentContract } from "./contracts/experiment.contract";
import { feedContract } from "./contracts/feed.contract";
import { healthContract } from "./contracts/health.contract";
import { iotContract } from "./contracts/iot.contract";
import { macroContract } from "./contracts/macro.contract";
import { organizationContract } from "./contracts/organization.contract";
import { protocolContract } from "./contracts/protocol.contract";
import { sharingContract } from "./contracts/sharing.contract";
import { userContract } from "./contracts/user.contract";
import { workbookContract } from "./contracts/workbook.contract";

// Initialize the main contract
const c = initContract();

// Export the main API contract
export const contract = c.router({
  auth: authContract,
  experiments: experimentContract,
  feed: feedContract,
  health: healthContract,
  iot: iotContract,
  macros: macroContract,
  organizations: organizationContract,
  protocols: protocolContract,
  sharing: sharingContract,
  users: userContract,
  workbooks: workbookContract,
});

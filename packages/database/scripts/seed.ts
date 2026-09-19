import { db } from "../src/database";
import { seedCalibrations } from "./seed/calibration.seed";
import { clearSeedData } from "./seed/clear.seed";
import { seedContributors } from "./seed/contributor.seed";
import { seedDeviceGroups } from "./seed/device-group.seed";
import { seedExperimentDevices } from "./seed/experiment-device.seed";
import { seedExperiments } from "./seed/experiment.seed";
import { seedFlows } from "./seed/flow.seed";
import { seedDevices } from "./seed/iot-device.seed";
import { seedMacros } from "./seed/macro.seed";
import { seedProtocolMacroLinks } from "./seed/protocol-macro.seed";
import { seedProtocols } from "./seed/protocol.seed";
import { seedUser } from "./seed/user.seed";
import { seedWorkbooks } from "./seed/workbook.seed";

/**
 * Order is a dependency order, not a preference: a later seed reads the rows an
 * earlier one returned.
 */
async function main() {
  console.log("Clearing previous seed data...");
  await clearSeedData();

  console.log("Seeding local database...");

  const { user, personalOrganizationId } = await seedUser();

  const createdProtocols = await seedProtocols(user, personalOrganizationId);
  const createdMacros = await seedMacros(user, personalOrganizationId);
  await seedProtocolMacroLinks(createdProtocols, createdMacros);

  const createdExperiments = await seedExperiments(user, personalOrganizationId);
  await seedContributors(createdExperiments);
  await seedFlows(createdExperiments);
  await seedWorkbooks(user, personalOrganizationId, createdExperiments, createdProtocols);

  const createdDevices = await seedDevices(user, personalOrganizationId);
  await seedExperimentDevices(user, createdDevices, createdExperiments);
  await seedDeviceGroups(user, personalOrganizationId, createdDevices);

  await seedCalibrations(user, personalOrganizationId, createdDevices);

  console.log("Seed complete!");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$client.end();
  });

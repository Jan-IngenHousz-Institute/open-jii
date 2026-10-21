import { getLocalUploadIdentity } from "~/features/auth/services/local-upload-identity";
import { getMeasurementIds, UNSYNCED_STATUSES } from "~/shared/db/measurements-storage";
import { createLogger } from "~/shared/observability/logger";

import { getOutbox } from "./upload";

const log = createLogger("resume-owned-uploads");

export async function resumeOwnedUploads(userId: string): Promise<void> {
  try {
    const ids = await getMeasurementIds(UNSYNCED_STATUSES);
    if (getLocalUploadIdentity()?.userId !== userId) return;
    getOutbox().enqueueMany(ids);
  } catch (err) {
    log.warn("Could not resume held uploads", { err });
  }
}

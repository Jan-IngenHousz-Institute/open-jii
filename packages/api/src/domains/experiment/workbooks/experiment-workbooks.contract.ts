import { oc } from "@orpc/contract";

import {
  zAttachWorkbookBody,
  zAttachWorkbookResponse,
} from "../../workbook/workbook-version.schema";
import { zExperiment, zExperimentIdPathParam } from "../experiment.schema";

export const experimentWorkbooksContract = {
  attachWorkbook: oc
    .route({ method: "POST", path: "/api/v1/experiments/{id}/workbook/attach", successStatus: 200 })
    .input(zExperimentIdPathParam.merge(zAttachWorkbookBody))
    .output(zAttachWorkbookResponse),
  detachWorkbook: oc
    .route({ method: "POST", path: "/api/v1/experiments/{id}/workbook/detach", successStatus: 200 })
    .input(zExperimentIdPathParam)
    .output(zExperiment.omit({ anonymizeContributors: true })),
  upgradeWorkbookVersion: oc
    .route({
      method: "POST",
      path: "/api/v1/experiments/{id}/workbook/upgrade",
      successStatus: 200,
    })
    .input(zExperimentIdPathParam)
    .output(zAttachWorkbookResponse),
};

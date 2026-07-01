import { oc } from "@orpc/contract";
import { z } from "zod";

import {
  zWorkbookVersion,
  zWorkbookVersionIdPathParam,
  zWorkbookVersionList,
} from "./workbook-version.schema";
import {
  zCreateWorkbookRequestBody,
  zUpdateWorkbookRequestBody,
  zWorkbook,
  zWorkbookFilterQuery,
  zWorkbookIdPathParam,
  zWorkbookList,
} from "./workbook.schema";

export const workbookContract = {
  listWorkbooks: oc
    .route({ method: "GET", path: "/api/v1/workbooks", successStatus: 200 })
    .input(zWorkbookFilterQuery)
    .output(zWorkbookList),
  getWorkbook: oc
    .route({ method: "GET", path: "/api/v1/workbooks/{id}", successStatus: 200 })
    .input(zWorkbookIdPathParam)
    .output(zWorkbook),
  createWorkbook: oc
    .route({ method: "POST", path: "/api/v1/workbooks", successStatus: 201 })
    .input(zCreateWorkbookRequestBody)
    .output(zWorkbook),
  updateWorkbook: oc
    .route({ method: "PATCH", path: "/api/v1/workbooks/{id}", successStatus: 200 })
    .input(zWorkbookIdPathParam.merge(zUpdateWorkbookRequestBody))
    .output(zWorkbook),
  deleteWorkbook: oc
    .route({ method: "DELETE", path: "/api/v1/workbooks/{id}", successStatus: 204 })
    .input(zWorkbookIdPathParam)
    .output(z.void()),
  listWorkbookVersions: oc
    .route({ method: "GET", path: "/api/v1/workbooks/{id}/versions", successStatus: 200 })
    .input(zWorkbookIdPathParam)
    .output(zWorkbookVersionList),
  getWorkbookVersion: oc
    .route({
      method: "GET",
      path: "/api/v1/workbooks/{id}/versions/{versionId}",
      successStatus: 200,
    })
    .input(zWorkbookVersionIdPathParam)
    .output(zWorkbookVersion),
};

import { oc } from "@orpc/contract";

import { zExperimentIdPathParam } from "../experiment/experiment.schema";
import {
  zDataset,
  zDatasetIdPathParam,
  zDatasetList,
  zDatasetMemberList,
  zDatasetPlotChecks,
  zDatasetReadiness,
  zDatasetReviewDetail,
  zDatasetScope,
  zFlaggedReadingList,
  zListDatasetsQuery,
  zPublicDataset,
  zPublishDatasetBody,
  zRelatedPublication,
  zReturnDatasetBody,
  zReviewQueue,
  zWithdrawDatasetBody,
} from "./dataset.schema";

const datasetRoutes = {
  listExperimentDatasets: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/datasets", successStatus: 200 })
    .input(zExperimentIdPathParam)
    .output(zDatasetList),
  createDataset: oc
    .route({ method: "POST", path: "/api/v1/experiments/{id}/datasets", successStatus: 201 })
    .input(zExperimentIdPathParam)
    .output(zDataset),
  listDatasets: oc
    .route({ method: "GET", path: "/api/v1/datasets", successStatus: 200 })
    .input(zListDatasetsQuery)
    .output(zDatasetList),
  getDataset: oc
    .route({ method: "GET", path: "/api/v1/datasets/{id}", successStatus: 200 })
    .input(zDatasetIdPathParam)
    .output(zDataset),
  getDatasetScope: oc
    .route({ method: "GET", path: "/api/v1/datasets/{id}/scope", successStatus: 200 })
    .input(zDatasetIdPathParam)
    .output(zDatasetScope),
  // Everyone Describe offers as an author, a contributor or neither, before anyone is named.
  listDatasetMembers: oc
    .route({ method: "GET", path: "/api/v1/datasets/{id}/members", successStatus: 200 })
    .input(zDatasetIdPathParam)
    .output(zDatasetMemberList),
  listDatasetFlaggedReadings: oc
    .route({ method: "GET", path: "/api/v1/datasets/{id}/flagged-readings", successStatus: 200 })
    .input(zDatasetIdPathParam)
    .output(zFlaggedReadingList),
  getDatasetPlotChecks: oc
    .route({ method: "GET", path: "/api/v1/datasets/{id}/plot-checks", successStatus: 200 })
    .input(zDatasetIdPathParam)
    .output(zDatasetPlotChecks),
  getDatasetReadiness: oc
    .route({ method: "GET", path: "/api/v1/datasets/{id}/readiness", successStatus: 200 })
    .input(zDatasetIdPathParam)
    .output(zDatasetReadiness),
  publishDataset: oc
    .route({ method: "POST", path: "/api/v1/datasets/{id}/publish", successStatus: 200 })
    .input(zDatasetIdPathParam.merge(zPublishDatasetBody))
    .output(zDataset),
  // Answered only to data stewards, whom JII names.
  listReviewQueue: oc
    .route({ method: "GET", path: "/api/v1/dataset-reviews", successStatus: 200 })
    .output(zReviewQueue),
  getDatasetReview: oc
    .route({ method: "GET", path: "/api/v1/dataset-reviews/{id}", successStatus: 200 })
    .input(zDatasetIdPathParam)
    .output(zDatasetReviewDetail),
  approveDataset: oc
    .route({ method: "POST", path: "/api/v1/dataset-reviews/{id}/approve", successStatus: 200 })
    .input(zDatasetIdPathParam)
    .output(zDataset),
  returnDataset: oc
    .route({ method: "POST", path: "/api/v1/dataset-reviews/{id}/return", successStatus: 200 })
    .input(zDatasetIdPathParam.merge(zReturnDatasetBody))
    .output(zDataset),
  // Returns a dataset In review to Draft before a data steward has decided.
  cancelDatasetReview: oc
    .route({ method: "POST", path: "/api/v1/datasets/{id}/cancel-review", successStatus: 200 })
    .input(zDatasetIdPathParam)
    .output(zDataset),
  withdrawDataset: oc
    .route({ method: "POST", path: "/api/v1/datasets/{id}/withdraw", successStatus: 200 })
    .input(zDatasetIdPathParam.merge(zWithdrawDatasetBody))
    .output(zDataset),
  // Answered without a session, so the DOI never resolves to a sign-in screen.
  getPublicDataset: oc
    .route({ method: "GET", path: "/api/v1/datasets/{id}/public", successStatus: 200 })
    .input(zDatasetIdPathParam)
    .output(zPublicDataset),
  listExperimentPublications: oc
    .route({ method: "GET", path: "/api/v1/experiments/{id}/publications", successStatus: 200 })
    .input(zExperimentIdPathParam)
    .output(zRelatedPublication.array()),
};

type DatasetRoutes = typeof datasetRoutes;

/**
 * An interface, because declaration emit refers to one by name while it inlines an alias. Inlined,
 * these schemas push the root contract past the size the compiler will serialize.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DatasetContract extends DatasetRoutes {}

export const datasetContract: DatasetContract = datasetRoutes;

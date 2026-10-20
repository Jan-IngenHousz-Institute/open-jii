import { oc } from "@orpc/contract";

import { zExperimentIdPathParam } from "../experiment/experiment.schema";
import {
  zDataset,
  zDatasetIdPathParam,
  zDatasetList,
  zDatasetReadiness,
  zDatasetScope,
  zFlaggedReadingList,
  zListDatasetsQuery,
  zPublicDataset,
  zPublishDatasetBody,
  zRelatedPublication,
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
  listDatasetFlaggedReadings: oc
    .route({ method: "GET", path: "/api/v1/datasets/{id}/flagged-readings", successStatus: 200 })
    .input(zDatasetIdPathParam)
    .output(zFlaggedReadingList),
  getDatasetReadiness: oc
    .route({ method: "GET", path: "/api/v1/datasets/{id}/readiness", successStatus: 200 })
    .input(zDatasetIdPathParam)
    .output(zDatasetReadiness),
  publishDataset: oc
    .route({ method: "POST", path: "/api/v1/datasets/{id}/publish", successStatus: 200 })
    .input(zDatasetIdPathParam.merge(zPublishDatasetBody))
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

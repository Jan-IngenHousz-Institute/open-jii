import { oc } from "@orpc/contract";

import { zIotCredentials, zIotUploadUrl, zIotUploadUrlRequest } from "./iot.schema";

export const iotContract = {
  getCredentials: oc
    .route({ method: "GET", path: "/api/v1/iot/credentials", successStatus: 200 })
    .output(zIotCredentials),
  getUploadUrl: oc
    .route({ method: "POST", path: "/api/v1/iot/upload-url", successStatus: 200 })
    .input(zIotUploadUrlRequest)
    .output(zIotUploadUrl),
};

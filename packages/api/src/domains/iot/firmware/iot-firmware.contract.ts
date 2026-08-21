import { oc } from "@orpc/contract";

import { zFirmwareFamilyPathParam, zFirmwareReleaseList } from "./iot-firmware.schema";

export const iotFirmwareContract = {
  listIotFirmwareReleases: oc
    .route({
      method: "GET",
      path: "/api/v1/iot/firmware/{family}/releases",
      successStatus: 200,
    })
    .input(zFirmwareFamilyPathParam)
    .output(zFirmwareReleaseList),
};

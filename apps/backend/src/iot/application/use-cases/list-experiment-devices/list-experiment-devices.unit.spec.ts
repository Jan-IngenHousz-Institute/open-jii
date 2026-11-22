import { Test } from "@nestjs/testing";

import { AuthorizationService } from "../../../../authorization/authorization.service";
import { assertSuccess, success } from "../../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../../../experiments/core/repositories/experiment.repository";
import type { ExperimentDeviceDto } from "../../../core/models/experiment-device.model";
import { AWS_PORT } from "../../../core/ports/aws.port";
import { IOT_DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import { ExperimentDeviceRepository } from "../../../core/repositories/experiment-device.repository";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";
import { ListExperimentDevicesUseCase } from "./list-experiment-devices";

const NOW = new Date("2026-11-22T10:00:00.000Z");

function identity(id: string): ExperimentDeviceDto["device"] {
  return {
    id,
    thingName: id,
    serialNumber: id,
    name: id,
    status: "active",
    deviceType: "ambyte",
  };
}

describe("ListExperimentDevicesUseCase row access", () => {
  it("checks only visible unbound identities, including the explicitly selected detail", async () => {
    const can = vi
      .fn()
      .mockResolvedValueOnce({ allow: true, reason: "owner" })
      .mockResolvedValueOnce({ allow: true, reason: "owner" })
      .mockResolvedValueOnce({ allow: false });
    const bound = identity("bound");
    const unbound = ["visible", "selected", "hidden"].map(identity);
    const module = await Test.createTestingModule({
      providers: [
        ListExperimentDevicesUseCase,
        {
          provide: ExperimentRepository,
          useValue: {
            checkAccess: vi.fn().mockResolvedValue(success({ experiment: { id: "experiment" } })),
          },
        },
        {
          provide: ExperimentDeviceRepository,
          useValue: {
            listByExperiment: vi
              .fn()
              .mockResolvedValue(
                success([{ device: bound, addedBy: "user", addedAt: NOW, registeredAt: NOW }]),
              ),
            countByDevices: vi.fn().mockResolvedValue(success(new Map())),
          },
        },
        {
          provide: IotDeviceRepository,
          useValue: {
            findByThingNames: vi
              .fn()
              .mockResolvedValue(success(unbound.map((device) => ({ ...device, createdAt: NOW })))),
          },
        },
        { provide: AuthorizationService, useValue: { can } },
        {
          provide: AWS_PORT,
          useValue: { searchThingsConnectivity: vi.fn().mockResolvedValue(success(new Map())) },
        },
        {
          provide: IOT_DATABRICKS_PORT,
          useValue: {
            getExperimentPublishers: vi.fn().mockResolvedValue(
              success(
                unbound.map(({ thingName }, index) => ({
                  clientId: thingName,
                  count: 1,
                  lastDataAt: new Date(NOW.getTime() - index * 1000).toISOString(),
                })),
              ),
            ),
            getExperimentDeviceStats: vi.fn().mockResolvedValue(success([])),
            getDevicesLastActivity: vi.fn().mockResolvedValue(success(new Map())),
          },
        },
      ],
    }).compile();

    try {
      const result = await module
        .get(ListExperimentDevicesUseCase)
        .execute("experiment", "user", NOW, { page: 1, pageSize: 2, selectedClientId: "selected" });

      assertSuccess(result);
      expect(result.value.devices.map(({ clientId, canView }) => ({ clientId, canView }))).toEqual([
        { clientId: "bound", canView: true },
        { clientId: "visible", canView: true },
      ]);
      expect(result.value.pagination?.selected).toMatchObject({
        clientId: "selected",
        canView: false,
      });
      expect(can.mock.calls).toEqual([
        ["user", { resourceType: "experiment", resourceId: "experiment", action: "read" }],
        ["user", { resourceType: "device", resourceId: "visible", action: "read" }],
        ["user", { resourceType: "device", resourceId: "selected", action: "read" }],
      ]);
    } finally {
      await module.close();
    }
  });
});

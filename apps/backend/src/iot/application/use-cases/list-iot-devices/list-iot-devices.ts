import { Inject, Injectable, Logger } from "@nestjs/common";

import type { IotDeviceFilterQuery, IotDeviceRung } from "@repo/api/domains/iot/iot.schema";
import { DEFAULT_PAGE_SIZE } from "@repo/api/shared/listing";
import type { PaginatedList } from "@repo/api/shared/listing";

import { Result, failure, success } from "../../../../common/utils/fp-utils";
import { IotDeviceDto } from "../../../core/models/iot-device.model";
import { AWS_PORT } from "../../../core/ports/aws.port";
import type { AwsPort, ThingConnectivity } from "../../../core/ports/aws.port";
import { ExperimentDeviceRepository } from "../../../core/repositories/experiment-device.repository";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";

export type IotDeviceWithConnectivityDto = IotDeviceDto & {
  connectivity: { connected: boolean; lastSeenAt: string | null } | null;
  boundExperimentCount: number;
};

type DevicePage = PaginatedList<IotDeviceWithConnectivityDto> & {
  statusCounts: Record<IotDeviceRung, number>;
};

@Injectable()
export class ListIotDevicesUseCase {
  private readonly logger = new Logger(ListIotDevicesUseCase.name);

  constructor(
    @Inject(AWS_PORT)
    private readonly awsPort: AwsPort,
    private readonly deviceRepository: IotDeviceRepository,
    private readonly experimentDeviceRepository: ExperimentDeviceRepository,
  ) {}

  async execute(userId: string): Promise<Result<IotDeviceWithConnectivityDto[]>>;
  async execute(
    userId: string,
    query: IotDeviceFilterQuery & { page: number },
  ): Promise<Result<DevicePage>>;
  async execute(
    userId: string,
    query: IotDeviceFilterQuery,
  ): Promise<Result<IotDeviceWithConnectivityDto[] | DevicePage>>;
  async execute(
    userId: string,
    query: IotDeviceFilterQuery = {},
  ): Promise<Result<IotDeviceWithConnectivityDto[] | DevicePage>> {
    this.logger.log({
      msg: "Listing devices",
      operation: "listIotDevices",
      userId,
    });

    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const devicesResult =
      query.page !== undefined
        ? await this.deviceRepository.findPage({ ...query, userId }, query.page, pageSize)
        : query.search?.trim() || query.status?.length || query.family?.length || query.sort?.length
          ? await this.deviceRepository.findAll({ ...query, userId })
          : await this.deviceRepository.listAccessible(userId);
    if (devicesResult.isFailure()) {
      return devicesResult;
    }

    const listing = devicesResult.value;
    const devices = Array.isArray(listing) ? listing : listing.items;
    const bindingsResult = await this.experimentDeviceRepository.countByDevices(
      devices.map((device) => device.id),
    );
    if (bindingsResult.isFailure()) {
      return failure(bindingsResult.error);
    }
    const bindings = bindingsResult.value;
    const connectivity = await this.lookupConnectivity(devices.map((device) => device.thingName));

    const items = devices.map((device) => {
      const thing = connectivity?.get(device.thingName);
      return {
        ...device,
        connectivity: thing ? { connected: thing.connected, lastSeenAt: thing.lastSeenAt } : null,
        boundExperimentCount: bindings.get(device.id) ?? 0,
      };
    });
    return success(
      Array.isArray(listing)
        ? items
        : {
            ...listing,
            items,
            page: query.page ?? 1,
            pageSize,
            totalPages: Math.max(1, Math.ceil(listing.totalCount / pageSize)),
          },
    );
  }

  // Connectivity is an enrichment, never a gate: a fleet-index failure (or an
  // index still building after first enable) degrades every device to an
  // unknown state instead of failing the list.
  private async lookupConnectivity(
    thingNames: string[],
  ): Promise<Map<string, ThingConnectivity> | null> {
    if (thingNames.length === 0) {
      return null;
    }

    const result = await this.awsPort.searchThingsConnectivity(thingNames);
    if (result.isFailure()) {
      this.logger.warn({
        msg: "Fleet-index connectivity lookup failed; devices render as unknown",
        operation: "listIotDevices",
        errorCode: result.error.code,
      });
      return null;
    }

    return result.value;
  }
}

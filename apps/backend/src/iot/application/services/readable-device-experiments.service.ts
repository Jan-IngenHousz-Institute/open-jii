import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { Result, failure, success } from "../../../common/utils/fp-utils";
import { ExperimentRepository } from "../../../experiments/core/repositories/experiment.repository";
import type { DeviceDataSource } from "../../core/models/device-data.model";
import type { DeviceWindow } from "../../core/ports/device-reads.port";
import { DeviceDataSourceService } from "./device-data-source.service";

/**
 * Reading a device is not reading what it served: of the experiments its rows claim, a device's
 * pages show only those the caller can read themselves, as its list of bindings does.
 */
@Injectable()
export class ReadableDeviceExperimentsService {
  constructor(
    private readonly dataSource: DeviceDataSourceService,
    private readonly experimentRepository: ExperimentRepository,
  ) {}

  /** Over the device's rows in the window, or over all of them when no window is given. */
  async list(
    thingName: string,
    userId: string,
    source: DeviceDataSource,
    window?: DeviceWindow,
  ): Promise<Result<string[]>> {
    const claimedResult = await this.dataSource
      .readsFor(source)
      .getDeviceExperimentIds(thingName, window);
    if (claimedResult.isFailure()) {
      return failure(claimedResult.error);
    }

    // A row's experiment is text from the topic or path it arrived on, so it may name none.
    const isExperimentId = z.string().guid();
    const claimed = claimedResult.value.filter(
      (experimentId) => isExperimentId.safeParse(experimentId).success,
    );

    const readableResult = await this.experimentRepository.findReadableIds(claimed, userId);
    if (readableResult.isFailure()) {
      return failure(readableResult.error);
    }

    // Postgres answers in lowercase, while a claim keeps the spelling it arrived in, which the
    // source's rows are then filtered by.
    const readable = new Set(readableResult.value);
    return success(claimed.filter((experimentId) => readable.has(experimentId.toLowerCase())));
  }
}

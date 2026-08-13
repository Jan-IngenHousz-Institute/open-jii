import { Injectable, Logger } from "@nestjs/common";

import type { DeviceMonitoring, MonitoringBucket } from "@repo/api/domains/iot/iot.schema";

import { AppError, Result, failure, success } from "../../../../common/utils/fp-utils";
import { IotDeviceRepository } from "../../../core/repositories/iot-device.repository";
import { GetDeviceBatteryUseCase } from "../get-device-battery/get-device-battery";
import { GetDevicePayloadStatsUseCase } from "../get-device-payload-stats/get-device-payload-stats";
import { GetDeviceSessionsUseCase } from "../get-device-sessions/get-device-sessions";
import { GetDeviceThroughputUseCase } from "../get-device-throughput/get-device-throughput";

/**
 * Orchestrates the monitoring dashboard response: resolves the device once,
 * then runs the three single-responsibility queries in parallel.
 */
@Injectable()
export class GetDeviceMonitoringUseCase {
  private readonly logger = new Logger(GetDeviceMonitoringUseCase.name);

  constructor(
    private readonly deviceRepository: IotDeviceRepository,
    private readonly getDeviceSessions: GetDeviceSessionsUseCase,
    private readonly getDeviceThroughput: GetDeviceThroughputUseCase,
    private readonly getDeviceBattery: GetDeviceBatteryUseCase,
    private readonly getDevicePayloadStats: GetDevicePayloadStatsUseCase,
  ) {}

  async execute(
    deviceId: string,
    from: string,
    to: string,
    bucket: MonitoringBucket,
    userId: string,
  ): Promise<Result<DeviceMonitoring>> {
    this.logger.log({
      msg: "Getting device monitoring data",
      operation: "getDeviceMonitoring",
      deviceId,
      userId,
      bucket,
    });

    const deviceResult = await this.deviceRepository.findById(deviceId);
    if (deviceResult.isFailure()) {
      return failure(deviceResult.error);
    }
    if (!deviceResult.value) {
      return failure(AppError.notFound(`IotDevice with ID ${deviceId} not found`));
    }
    const thingName = deviceResult.value.thingName;

    const [sessionsResult, throughputResult, batteryResult, payloadResult] = await Promise.all([
      this.getDeviceSessions.execute(thingName, from, to),
      this.getDeviceThroughput.execute(thingName, from, to, bucket),
      this.getDeviceBattery.execute(thingName, from, to, bucket),
      this.getDevicePayloadStats.execute(thingName, from, to),
    ]);
    if (sessionsResult.isFailure()) {
      return failure(sessionsResult.error);
    }
    if (throughputResult.isFailure()) {
      return failure(throughputResult.error);
    }
    if (batteryResult.isFailure()) {
      return failure(batteryResult.error);
    }
    if (payloadResult.isFailure()) {
      return failure(payloadResult.error);
    }

    return success({
      bucket,
      ...sessionsResult.value,
      throughput: throughputResult.value,
      battery: batteryResult.value,
      payload: payloadResult.value,
    });
  }
}

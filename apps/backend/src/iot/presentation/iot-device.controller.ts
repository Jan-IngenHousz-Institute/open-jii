import { Controller, Inject, Logger } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { Session } from "@thallesp/nestjs-better-auth";
import type { UserSession } from "@thallesp/nestjs-better-auth";

import { FEATURE_FLAGS } from "@repo/analytics";
import { iotContract } from "@repo/api/domains/iot/iot.contract";

import { AuthorizationService } from "../../authorization/authorization.service";
import { CanAccess } from "../../authorization/can-access.decorator";
import { CanCreateInOrg } from "../../authorization/can-create-in-org.guard";
import { resolveResourceCapabilities } from "../../authorization/resource-capabilities";
import { formatDates, formatDatesList } from "../../common/utils/date-formatter";
import { AppError } from "../../common/utils/fp-utils";
import { throwOrpcError, throwOrpcFailure } from "../../common/utils/orpc-fp";
import { BulkRegisterIotDevicesUseCase } from "../application/use-cases/bulk-register-iot-devices/bulk-register-iot-devices";
import { DeleteIotDeviceUseCase } from "../application/use-cases/delete-iot-device/delete-iot-device";
import { EnsureMobileDeviceUseCase } from "../application/use-cases/ensure-mobile-device/ensure-mobile-device";
import { GetDeviceMonitoringUseCase } from "../application/use-cases/get-device-monitoring/get-device-monitoring";
import { GetDeviceObservedExperimentsUseCase } from "../application/use-cases/get-device-observed-experiments/get-device-observed-experiments";
import { GetIotDeviceActivityUseCase } from "../application/use-cases/get-iot-device-activity/get-iot-device-activity";
import { GetIotDeviceFirmwareHistoryUseCase } from "../application/use-cases/get-iot-device-firmware-history/get-iot-device-firmware-history";
import { GetIotDeviceUseCase } from "../application/use-cases/get-iot-device/get-iot-device";
import { GetIotFleetMonitoringUseCase } from "../application/use-cases/get-iot-fleet-monitoring/get-iot-fleet-monitoring";
import { IssueIotCredentialsUseCase } from "../application/use-cases/issue-iot-credentials/issue-iot-credentials";
import { ListIotDevicesUseCase } from "../application/use-cases/list-iot-devices/list-iot-devices";
import { RegisterIotDeviceUseCase } from "../application/use-cases/register-iot-device/register-iot-device";
import { RevokeIotCredentialsUseCase } from "../application/use-cases/revoke-iot-credentials/revoke-iot-credentials";
import { RotateIotCredentialsUseCase } from "../application/use-cases/rotate-iot-credentials/rotate-iot-credentials";
import { ANALYTICS_PORT } from "../core/ports/analytics.port";
import type { AnalyticsPort } from "../core/ports/analytics.port";

@Controller()
export class IotDeviceController {
  private readonly logger = new Logger(IotDeviceController.name);

  constructor(
    @Inject(ANALYTICS_PORT)
    private readonly analyticsPort: AnalyticsPort,
    private readonly registerIotDeviceUseCase: RegisterIotDeviceUseCase,
    private readonly bulkRegisterIotDevicesUseCase: BulkRegisterIotDevicesUseCase,
    private readonly ensureMobileDeviceUseCase: EnsureMobileDeviceUseCase,
    private readonly listIotDevicesUseCase: ListIotDevicesUseCase,
    private readonly getIotDeviceUseCase: GetIotDeviceUseCase,
    private readonly getIotDeviceActivityUseCase: GetIotDeviceActivityUseCase,
    private readonly getDeviceMonitoringUseCase: GetDeviceMonitoringUseCase,
    private readonly getIotFleetMonitoringUseCase: GetIotFleetMonitoringUseCase,
    private readonly getDeviceObservedExperimentsUseCase: GetDeviceObservedExperimentsUseCase,
    private readonly getIotDeviceFirmwareHistoryUseCase: GetIotDeviceFirmwareHistoryUseCase,
    private readonly deleteIotDeviceUseCase: DeleteIotDeviceUseCase,
    private readonly issueIotCredentialsUseCase: IssueIotCredentialsUseCase,
    private readonly revokeIotCredentialsUseCase: RevokeIotCredentialsUseCase,
    private readonly rotateIotCredentialsUseCase: RotateIotCredentialsUseCase,
    private readonly authz: AuthorizationService,
  ) {}

  private devicesEnabled(session: UserSession): Promise<boolean> {
    return this.analyticsPort.isFeatureFlagEnabled(
      FEATURE_FLAGS.IOT_DEVICES,
      session.user.email || session.user.id,
    );
  }

  private disabled(operation: string): never {
    return throwOrpcError(
      AppError.forbidden("The device registry is currently disabled"),
      this.logger,
      operation,
    );
  }

  @Implement(iotContract.listIotDevices)
  listIotDevices(@Session() session: UserSession) {
    return implement(iotContract.listIotDevices).handler(async () => {
      if (!(await this.devicesEnabled(session))) this.disabled("listIotDevices");

      const result = await this.listIotDevicesUseCase.execute(session.user.id);

      if (result.isSuccess()) {
        return formatDatesList(result.value);
      }

      return throwOrpcFailure(result, this.logger, "listIotDevices");
    });
  }

  // Declared before the {deviceId} routes: the static "monitoring" segment
  // must never be read as a device id.
  @Implement(iotContract.getIotFleetMonitoring)
  getIotFleetMonitoring(@Session() session: UserSession) {
    return implement(iotContract.getIotFleetMonitoring).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("getIotFleetMonitoring");

      const result = await this.getIotFleetMonitoringUseCase.execute(session.user.id, {
        from: input.from,
        to: input.to,
        bucket: input.bucket,
      });

      if (result.isSuccess()) {
        return result.value;
      }

      return throwOrpcFailure(result, this.logger, "getIotFleetMonitoring");
    });
  }

  @CanCreateInOrg()
  @Implement(iotContract.registerIotDevice)
  registerIotDevice(@Session() session: UserSession) {
    return implement(iotContract.registerIotDevice).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("registerIotDevice");

      const result = await this.registerIotDeviceUseCase.execute(
        input,
        session.user.id,
        input.organizationId ?? null,
      );

      if (result.isSuccess()) {
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger, "registerIotDevice");
    });
  }

  @CanCreateInOrg()
  @Implement(iotContract.bulkRegisterIotDevices)
  bulkRegisterIotDevices(@Session() session: UserSession) {
    return implement(iotContract.bulkRegisterIotDevices).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("bulkRegisterIotDevices");

      const result = await this.bulkRegisterIotDevicesUseCase.execute(input, session.user.id);

      if (result.isSuccess()) {
        const { devices, ...rest } = result.value;
        return {
          ...rest,
          devices: devices.map((row) => ({
            ...row,
            device: row.device === null ? null : formatDates(row.device),
          })),
        };
      }

      return throwOrpcFailure(result, this.logger, "bulkRegisterIotDevices");
    });
  }

  @Implement(iotContract.ensureMobileDevice)
  ensureMobileDevice(@Session() session: UserSession) {
    return implement(iotContract.ensureMobileDevice).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("ensureMobileDevice");

      const result = await this.ensureMobileDeviceUseCase.execute(input, session.user.id);

      if (result.isSuccess()) {
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger, "ensureMobileDevice");
    });
  }

  @CanAccess({ resource: "device", action: "read", param: "deviceId" })
  @Implement(iotContract.getIotDevice)
  getIotDevice(@Session() session: UserSession) {
    return implement(iotContract.getIotDevice).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("getIotDevice");

      const result = await this.getIotDeviceUseCase.execute(input.deviceId, session.user.id);

      if (result.isSuccess()) {
        // The caller's effective capabilities ride along so the web app can gate the
        // Collaborators tab, the credentials surface and the danger zone on
        // capability rather than on `createdBy` — a "Can edit" grantee holds all
        // three. Resolved after the fetch succeeded, so a 404 stays a 404.
        const capabilities = await resolveResourceCapabilities(
          this.authz,
          session.user.id,
          "device",
          input.deviceId,
        );
        return { ...formatDates(result.value), capabilities };
      }

      return throwOrpcFailure(result, this.logger, "getIotDevice");
    });
  }

  @CanAccess({ resource: "device", action: "read", param: "deviceId" })
  @Implement(iotContract.getIotDeviceActivity)
  getIotDeviceActivity(@Session() session: UserSession) {
    return implement(iotContract.getIotDeviceActivity).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("getIotDeviceActivity");

      const result = await this.getIotDeviceActivityUseCase.execute(
        input.deviceId,
        session.user.id,
      );

      if (result.isSuccess()) {
        return result.value;
      }

      return throwOrpcFailure(result, this.logger, "getIotDeviceActivity");
    });
  }

  @CanAccess({ resource: "device", action: "read", param: "deviceId" })
  @Implement(iotContract.getDeviceObservedExperiments)
  getDeviceObservedExperiments(@Session() session: UserSession) {
    return implement(iotContract.getDeviceObservedExperiments).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("getDeviceObservedExperiments");

      const result = await this.getDeviceObservedExperimentsUseCase.execute(
        input.deviceId,
        input.from,
        input.to,
      );

      if (result.isSuccess()) {
        return { experiments: result.value };
      }

      return throwOrpcFailure(result, this.logger, "getDeviceObservedExperiments");
    });
  }

  @CanAccess({ resource: "device", action: "read", param: "deviceId" })
  @Implement(iotContract.getDeviceFirmwareHistory)
  getDeviceFirmwareHistory(@Session() session: UserSession) {
    return implement(iotContract.getDeviceFirmwareHistory).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("getDeviceFirmwareHistory");

      const result = await this.getIotDeviceFirmwareHistoryUseCase.execute(
        input.deviceId,
        input.from,
        input.to,
        input.bucket,
      );

      if (result.isSuccess()) {
        return { versions: result.value };
      }

      return throwOrpcFailure(result, this.logger, "getDeviceFirmwareHistory");
    });
  }

  @CanAccess({ resource: "device", action: "read", param: "deviceId" })
  @Implement(iotContract.getDeviceMonitoring)
  getDeviceMonitoring(@Session() session: UserSession) {
    return implement(iotContract.getDeviceMonitoring).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("getDeviceMonitoring");

      const result = await this.getDeviceMonitoringUseCase.execute(
        input.deviceId,
        input.from,
        input.to,
        input.bucket,
        session.user.id,
      );

      if (result.isSuccess()) {
        return result.value;
      }

      return throwOrpcFailure(result, this.logger, "getDeviceMonitoring");
    });
  }

  @CanAccess({ resource: "device", action: "manage", param: "deviceId" })
  @Implement(iotContract.deleteIotDevice)
  deleteIotDevice(@Session() session: UserSession) {
    return implement(iotContract.deleteIotDevice).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("deleteIotDevice");

      const result = await this.deleteIotDeviceUseCase.execute(input.deviceId, session.user.id);

      if (result.isSuccess()) {
        return undefined;
      }

      return throwOrpcFailure(result, this.logger, "deleteIotDevice");
    });
  }

  @CanAccess({ resource: "device", action: "manage", param: "deviceId" })
  @Implement(iotContract.issueIotCredentials)
  issueIotCredentials(@Session() session: UserSession) {
    return implement(iotContract.issueIotCredentials).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("issueIotCredentials");

      const result = await this.issueIotCredentialsUseCase.execute(input.deviceId, session.user.id);

      if (result.isSuccess()) {
        return result.value;
      }

      return throwOrpcFailure(result, this.logger, "issueIotCredentials");
    });
  }

  @CanAccess({ resource: "device", action: "manage", param: "deviceId" })
  @Implement(iotContract.rotateIotCredentials)
  rotateIotCredentials(@Session() session: UserSession) {
    return implement(iotContract.rotateIotCredentials).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("rotateIotCredentials");

      const result = await this.rotateIotCredentialsUseCase.execute(
        input.deviceId,
        session.user.id,
      );

      if (result.isSuccess()) {
        return result.value;
      }

      return throwOrpcFailure(result, this.logger, "rotateIotCredentials");
    });
  }

  @CanAccess({ resource: "device", action: "manage", param: "deviceId" })
  @Implement(iotContract.revokeIotCredentials)
  revokeIotCredentials(@Session() session: UserSession) {
    return implement(iotContract.revokeIotCredentials).handler(async ({ input }) => {
      if (!(await this.devicesEnabled(session))) this.disabled("revokeIotCredentials");

      const result = await this.revokeIotCredentialsUseCase.execute(
        input.deviceId,
        session.user.id,
      );

      if (result.isSuccess()) {
        return formatDates(result.value);
      }

      return throwOrpcFailure(result, this.logger, "revokeIotCredentials");
    });
  }
}

/**
 * @repo/iot
 * Platform-agnostic IoT device communication package
 */

// ── Core ────────────────────────────────────────────
export type {
  TransportType,
  TransportCategory,
  DeviceType,
  Device,
  ConnectionStatus,
  DeviceConnectionInfo,
  DeviceTransportSupport,
} from "./core/types";
export {
  DEVICE_TRANSPORT_SUPPORT,
  getDeviceTransportSupport,
  isTransportSupported,
} from "./core/types";
export type { SensorFamily, DeviceIdentity } from "./core/families";
export { SENSOR_FAMILIES, isSensorFamily } from "./core/families";
export type {
  CommandFamily,
  ValidateCommandOptions,
  ValidatedCommand,
} from "./core/command-validator";
export { validateCommandArtifact } from "./core/command-validator";
export type { ITransportAdapter, TransportAdapterFactory } from "./transport/interface";
export type {
  IDeviceDriver,
  CommandResult,
  ExecuteOptions,
  CommandProgress,
  CommandProgressListener,
  DeviceDriverOptions,
} from "./driver/driver-base";
export { DeviceDriver, DEFAULT_MAX_BUFFER_SIZE } from "./driver/driver-base";
// Connector aliases: family-agnostic names for the same driver contract
export { DeviceDriver as CommandConnector } from "./driver/driver-base";
export type { IDeviceDriver as ICommandConnector } from "./driver/driver-base";
export type { ICommandExecutor } from "./core/command-executor";
export { CommandExecutor } from "./core/command-executor";
export type { IdentifyDeviceOptions, IdentifiedDevice } from "./core/identify-device";
export { identifyDevice, createConnectorForFamily } from "./core/identify-device";

// ── Driver: MultispeQ ───────────────────────────────
export type {
  MultispeqStreamEvents,
  MultispeqCommandResult,
  MultispeqDeviceInfo,
} from "./driver/multispeq/interface";
export type {
  MultispeqCommandV1,
  MultispeqCommandV2,
  MultispeqCommand,
} from "./driver/multispeq/commands";
export {
  MULTISPEQ_CONSOLE,
  MULTISPEQ_COMMANDS_V1,
  MULTISPEQ_COMMANDS_V2,
  MULTISPEQ_COMMANDS,
} from "./driver/multispeq/commands";
export { MultispeqDriver } from "./driver/multispeq/driver";
export type { MultispeqTransportConfig, MultispeqTransportType } from "./driver/multispeq/config";
export { MULTISPEQ_SERIAL_DEFAULTS, MULTISPEQ_FRAMING } from "./driver/multispeq/config";
export type { ScanTimeoutOptions, VArrays } from "./driver/multispeq/multispeq-protocol-estimator";
export {
  estimateProtocolDurationMs,
  computeScanTimeoutMs,
  resolveCommandTimeoutMs,
  resolveNumericRef,
  resolveProtocolVariables,
  protocolRequiresInteraction,
  SCAN_TIMEOUT_DEFAULTS,
  MEASUREMENT_TIMEOUT_FLOOR_MS,
} from "./driver/multispeq/multispeq-protocol-estimator";

// ── Driver: Generic ─────────────────────────────────
export type {
  GenericDeviceEvents,
  GenericDeviceInfo,
  GenericInfoResponse,
  GenericCommandResponse,
  GenericDeviceConfig,
  GenericMeasurementData,
} from "./driver/generic/interface";
export type {
  GenericCommand,
  GenericRequiredCommand,
  GenericOptionalCommand,
  GenericCommandWithParams,
  CustomCommandWithParams,
} from "./driver/generic/commands";
export {
  GENERIC_COMMANDS,
  GENERIC_REQUIRED_COMMANDS,
  GENERIC_OPTIONAL_COMMANDS,
} from "./driver/generic/commands";
export { GenericDeviceDriver } from "./driver/generic/driver";
export type {
  GenericCommandConnectorEvents,
  GenericCommandConnectorConfig,
} from "./driver/generic/command-connector";
export { GenericCommandConnector } from "./driver/generic/command-connector";
export type { GenericDeviceTransportConfig, GenericDriverConfig } from "./driver/generic/config";
export {
  GENERIC_BLE_UUIDS,
  GENERIC_SERIAL_DEFAULTS,
  GENERIC_FRAMING,
} from "./driver/generic/config";

// ── Driver: Ambit ───────────────────────────────────
export { AmbitConnector } from "./driver/ambit/connector";

// ── Logger (public DI contract) ─────────────────────
export type { Logger } from "./utils/logger/logger";
export { defaultLogger } from "./utils/logger/logger";

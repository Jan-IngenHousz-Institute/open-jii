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
export type { ITransportAdapter, TransportAdapterFactory } from "./transport/interface";
export type { IDeviceDriver, CommandResult } from "./driver/driver-base";
export { DeviceDriver, DEFAULT_MAX_BUFFER_SIZE } from "./driver/driver-base";
export type { ICommandExecutor } from "./core/command-executor";
export { CommandExecutor } from "./core/command-executor";

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
export type { GenericDeviceTransportConfig, GenericDriverConfig } from "./driver/generic/config";
export {
  GENERIC_BLE_UUIDS,
  GENERIC_SERIAL_DEFAULTS,
  GENERIC_FRAMING,
} from "./driver/generic/config";

// ── Logger (public DI contract) ─────────────────────
export type { Logger } from "./utils/logger/logger";
export { defaultLogger } from "./utils/logger/logger";

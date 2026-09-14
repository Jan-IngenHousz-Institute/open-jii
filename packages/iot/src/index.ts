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
export type { IDeviceDriver, CommandResult, ExecuteOptions } from "./driver/driver-base";
export { DeviceDriver, DEFAULT_MAX_BUFFER_SIZE } from "./driver/driver-base";
export type { ICommandExecutor } from "./core/command-executor";
export { CommandExecutor } from "./core/command-executor";
export type { DeviceConfigDeliveryPayload } from "./core/onboarding";
export { deliverDeviceConfig, supportsConfigDelivery } from "./core/onboarding";

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
export type { GenericDeviceTransportConfig, GenericDriverConfig } from "./driver/generic/config";
export {
  GENERIC_BLE_UUIDS,
  GENERIC_SERIAL_DEFAULTS,
  GENERIC_FRAMING,
} from "./driver/generic/config";
export { GenericCommandConnector } from "./driver/generic/command-connector";
export type {
  GenericCommandConnectorConfig,
  GenericCommandConnectorEvents,
} from "./driver/generic/command-connector";

// ── Ambit driver (text console, command/response) ───
export { AmbitDriver } from "./driver/ambit/driver";
export type { AmbitDriverConfig } from "./driver/ambit/config";
export { AMBIT_SERIAL_DEFAULTS, AMBIT_FRAMING } from "./driver/ambit/config";
export { AMBIT_COMMANDS, AMBIT_SILENT_COMMANDS } from "./driver/ambit/commands";

// Bench instruments: rig equipment a calibration drives but never measures with.
export type {
  BenchInstrument,
  InstrumentReading,
  InstrumentSetpoint,
} from "./instrument/interface";
export { identityMatches, findSetpoint, findReading } from "./instrument/interface";
export { KiprimDcSource } from "./instrument/kiprim/instrument";
export { MicroPythonParReference } from "./instrument/micropython-par/instrument";
export type { MicroPythonParConfig } from "./instrument/micropython-par/instrument";
export { MICROPYTHON_COMMANDS } from "./instrument/micropython-par/commands";
export type { KiprimConfig } from "./instrument/kiprim/instrument";
export { KIPRIM_COMMANDS, KIPRIM_LIMITS } from "./instrument/kiprim/commands";
export {
  BENCH_INSTRUMENTS,
  identifyBenchInstrument,
  benchInstrumentForHandshake,
} from "./instrument/registry";
export type { BenchInstrumentFactory } from "./instrument/registry";

// Calibration write-back: approved coefficients become family console commands.
export {
  CALIBRATION_WRITERS,
  canWriteCalibration,
  formatCoefficient,
  writeCalibrationBlocks,
} from "./calibration/write-back";
export type {
  AppliedCalibrationBlocks,
  CalibrationWriteResults,
  CoefficientWriteResult,
  CoefficientWriter,
  FamilyCalibrationWriters,
} from "./calibration/write-back";

// Capture procedures: the declared steps a calibration runs at a bench.
export { runCaptureProcedure, bindBenchInstrument, shutdownRig } from "./procedure/interpreter";
export type {
  ProcedureContext,
  RigBinding,
  ReadTarget,
  SetpointTarget,
} from "./procedure/interpreter";
export { ProcedureAborted, ProcedureDeclined, ProcedureRigError } from "./procedure/operator";
export type { OperatorPort, ProcedureProgress } from "./procedure/operator";
export { requiredSeriesNames, DUT_ROLE, SWEEP_STIMULUS_COLUMN } from "./procedure/types";
export type {
  CaptureProcedure,
  CaptureResult,
  CapturePayload,
  ProcedureStep,
  ProcedureRead,
  SeriesRow,
  SeriesCell,
  SetpointValue,
} from "./procedure/types";
export type {
  AmbitParReading,
  AmbitTempReading,
  AmbitStreamEvents,
} from "./driver/ambit/interface";

// ── MiniPAR driver (LINE + JSON protocol modes) ─────
export { MiniParDriver } from "./driver/minipar/driver";
export type { MiniParDriverConfig } from "./driver/minipar/config";
export { MINIPAR_SERIAL_DEFAULTS, MINIPAR_FRAMING } from "./driver/minipar/config";
export { MINIPAR_COMMANDS } from "./driver/minipar/commands";
export type { MiniParMeasurementEnvelope, MiniParStreamEvents } from "./driver/minipar/interface";

// ── Device identity ─────────────────────────────────
export type { DeviceIdentity, SensorFamily } from "./core/families";
export { SENSOR_FAMILIES, isSensorFamily } from "./core/families";
export type { IdentifiedDevice, IdentifyDeviceOptions } from "./core/identify-device";
export { identifyDevice, createConnectorForFamily } from "./core/identify-device";

// ── Logger (public DI contract) ─────────────────────
export type { Logger } from "./utils/logger/logger";
export { defaultLogger } from "./utils/logger/logger";

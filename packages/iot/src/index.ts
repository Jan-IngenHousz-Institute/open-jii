/**
 * @repo/iot
 * Platform-agnostic IoT device communication package
 */

// Core exports
export * from "./core/types";
export * from "./transport/interface";
export * from "./driver/driver-base";
export * from "./core/command-executor";

// Driver exports - MultispeQ
export * from "./driver/multispeq/interface";
export * from "./driver/multispeq/commands";
export * from "./driver/multispeq/driver";
export * from "./driver/multispeq/config";

// Driver exports - Generic
export * from "./driver/generic/interface";
export * from "./driver/generic/commands";
export * from "./driver/generic/driver";
export * from "./driver/generic/config";

// Utility exports
export * from "./utils/emitter";
export * from "./utils/framing";
export * from "./utils/hex";
export * from "./utils/async";

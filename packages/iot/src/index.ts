/**
 * @repo/iot
 * Platform-agnostic IoT device communication package
 */

// Core exports
export * from "./core/types";
export * from "./transport/interface";
export * from "./protocol/base";
export * from "./core/command-executor";

// Protocol exports - MultispeQ
export * from "./protocol/multispeq/interface";
export * from "./protocol/multispeq/commands";
export * from "./protocol/multispeq/protocol";
export * from "./protocol/multispeq/config";

// Protocol exports - Generic
export * from "./protocol/generic/interface";
export * from "./protocol/generic/commands";
export * from "./protocol/generic/protocol";
export * from "./protocol/generic/config";

// Utility exports
export * from "./utils/emitter";
export * from "./utils/framing";
export * from "./utils/hex";
export * from "./utils/async";

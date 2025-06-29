import * as par from "./par";
import * as phi2 from "./phi2";
import * as spad from "./spad";

export const protocolsDefinitions = { spad, par, phi2 };

export type ProtocolName = keyof typeof protocolsDefinitions;

export function getProtocolDefinition(protocolName: ProtocolName) {
  return protocolsDefinitions[protocolName];
}

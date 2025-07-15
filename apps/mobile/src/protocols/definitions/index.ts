import * as par from "./par";
import * as phi2 from "./phi2";
import * as spad from "./spad";
import * as upd14 from "./upd14";

export const protocolsDefinitions = { spad, par, phi2, upd14 };

export type ProtocolName = keyof typeof protocolsDefinitions;

export function getProtocolDefinition(protocolName: ProtocolName) {
  return protocolsDefinitions[protocolName];
}

/**
 * CO2Dot driver: an ESP32 CO2 and spectral sensor whose console follows the
 * MiniPAR's style (`env`, `spec`, `spec_flash,<mA>,<n>`, ...). Commands pass
 * through verbatim, as they did when a CO2Dot fell back to the raw connector;
 * the family exists so the unit is identified and registered as a CO2Dot.
 * Its JSON hello carries `mac`, the eFuse MAC, which identification lifts into
 * the identity.
 */
import type { SensorFamily } from "../../core/families";
import { GenericCommandConnector } from "../generic/command-connector";

export class Co2DotDriver extends GenericCommandConnector {
  override readonly family: SensorFamily = "co2dot";
}

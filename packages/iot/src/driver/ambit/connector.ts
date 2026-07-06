import type { SensorFamily } from "../../core/families";
import { GenericDeviceDriver } from "../generic/driver";

/** Ambit connector stub. TODO: Ambit firmware contract undefined; speaks the generic JSON protocol for now. */
export class AmbitConnector extends GenericDeviceDriver {
  override readonly family: SensorFamily = "ambit";
}

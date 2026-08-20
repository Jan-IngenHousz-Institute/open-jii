import type { LineageNodeModel } from "./build-device-lineage";

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/**
 * One display title per node model, shared by the canvas node and the inspect
 * panel so a node never reads differently in the two places it appears.
 */
export function lineageNodeTitle(model: LineageNodeModel, t: TranslateFn): string {
  if (model.kind === "device") {
    return model.label;
  }
  if (model.kind === "broker") {
    return t("iot.devices.lineage.brokerTitle");
  }
  if (model.kind === "warehouse") {
    return t("iot.devices.lineage.warehouseTitle");
  }
  if (model.kind === "unattributed") {
    return t("iot.devices.lineage.unattributedTitle");
  }
  if (model.kind === "attribution-other") {
    return t("iot.devices.lineage.otherTitle", { count: model.folded });
  }
  return model.entity.label;
}

import * as ExpoApplication from "expo-application";
import { getLocalThingName } from "~/shared/stores/device-identity-store";

import { buildIngestTopicPrefix } from "@repo/api/transforms/iot-topic";

// Sentinel protocol_id for question-only uploads (no device sample). Carried
// in the payload since the lean topic has no protocol segment; the pipeline
// treats it like any other protocol_id value.
export const QUESTIONS_PROTOCOL_ID = "questions";

const SENSOR_TYPE = "mobile";

function appVersionSegment(): string {
  const version = ExpoApplication.nativeApplicationVersion;
  if (!version) {
    return "0";
  }
  return version.replace(/[^a-zA-Z0-9._-]/g, "-");
}

// The platform-owned prefix comes from the shared transform (the same one the
// onboarding config uses); the device-owned tail is sensorVersion = the app
// release and sensorId = this phone's thing name, the identity the MQTT
// connection itself uses.
export function getMeasurementMqttTopic({ experimentId }: { experimentId: string }): string {
  return `${buildIngestTopicPrefix(experimentId, SENSOR_TYPE)}/${appVersionSegment()}/${getLocalThingName()}`;
}

/**
 * Recovers the experiment id a stored topic was built from. A stored
 * measurement carries no experiment id of its own, so this is how a saved row
 * finds the experiment (and workbook) it belongs to. Both the current lean
 * format and the legacy templated format put the experiment id at segment 3
 * of the same `experiment/data_ingest/v1/…` prefix:
 *   current: experiment/data_ingest/v1/<experimentId>/<sensorType>/<version>/<sensorId>
 *   legacy:  experiment/data_ingest/v1/<experimentId>/multispeq/v1.0/<clientId>/<protocolId>
 * Anything else is not a measurement topic this app wrote.
 */
export function parseMeasurementTopic(topic: string): { experimentId?: string } {
  const parts = topic.split("/");
  if (parts[0] !== "experiment" || parts[1] !== "data_ingest" || parts[2] !== "v1") return {};
  return { experimentId: parts[3] || undefined };
}

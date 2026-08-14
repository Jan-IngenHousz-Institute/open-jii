import * as ExpoApplication from "expo-application";
import { getLocalThingName } from "~/shared/stores/device-identity-store";

// Sentinel protocol_id for question-only uploads (no device sample). Carried
// in the payload since the lean topic has no protocol segment; the pipeline
// treats it like any other protocol_id value.
export const QUESTIONS_PROTOCOL_ID = "questions";

// The canonical lean ingest shape (asyncapi.yaml, experiment_data_ingest_v1_lean):
// experiment/data_ingest/v1/{experimentId}/{sensorType}/{sensorVersion}/{sensorId}.
// sensorType is the device family, sensorVersion the app release, sensorId the
// phone's thing name, the same identity the MQTT connection uses.
const TOPIC_PREFIX = "experiment/data_ingest/v1";
const SENSOR_TYPE = "mobile";

function appVersionSegment(): string {
  const version = ExpoApplication.nativeApplicationVersion;
  if (!version) {
    return "0";
  }
  return version.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export function getMeasurementMqttTopic({ experimentId }: { experimentId: string }): string {
  return `${TOPIC_PREFIX}/${experimentId}/${SENSOR_TYPE}/${appVersionSegment()}/${getLocalThingName()}`;
}

import { getEnvVar } from "~/shared/stores/environment-store";

// Sentinel protocolId for question-only uploads (no MultispeQ sample).
// Routed by an AWS IoT rule like any real protocol — see CONTEXT.md "Topic".
export const QUESTIONS_PROTOCOL_ID = "questions";

export function getMultispeqMqttTopic({
  experimentId,
  protocolId,
}: {
  experimentId: string;
  protocolId: string;
}): string {
  return getEnvVar("MQTT_TOPIC")
    .replace(":clientId", getEnvVar("CLIENT_ID"))
    .replace(":experimentId", experimentId)
    .replace(":protocolId", protocolId);
}

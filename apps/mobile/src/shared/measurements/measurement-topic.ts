import { getEnvVar } from "~/shared/stores/environment-store";

// Sentinel command id for question-only uploads (no MultispeQ sample).
// Routed by an AWS IoT rule like any real command; see CONTEXT.md "Topic".
export const QUESTIONS_COMMAND_ID = "questions";

// The ":protocolId" topic segment is the AWS IoT routing contract; the wire
// topic keeps the legacy name even though the entity is now called a command.
export function getMultispeqMqttTopic({
  experimentId,
  commandId,
}: {
  experimentId: string;
  commandId: string;
}): string {
  return getEnvVar("MQTT_TOPIC")
    .replace(":clientId", getEnvVar("CLIENT_ID"))
    .replace(":experimentId", experimentId)
    .replace(":protocolId", commandId);
}

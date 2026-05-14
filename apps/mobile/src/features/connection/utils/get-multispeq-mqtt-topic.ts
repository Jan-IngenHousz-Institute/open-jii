import { getEnvVar } from "~/stores/environment-store";

export function getMultispeqMqttTopic({ experimentId, protocolId }) {
  return getEnvVar("MQTT_TOPIC")
    .replace(":clientId", getEnvVar("CLIENT_ID"))
    .replace(":experimentId", experimentId)
    .replace(":protocolId", protocolId);
}

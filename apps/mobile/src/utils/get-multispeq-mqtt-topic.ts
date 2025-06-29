import { assertEnvVariables } from "~/utils/assert";

const { MQTT_TOPIC, CLIENT_ID } = assertEnvVariables({
  MQTT_TOPIC: process.env.MQTT_TOPIC,
  CLIENT_ID: process.env.CLIENT_ID,
});

export function getMultispeqMqttTopic({ experimentId, protocolName }) {
  return MQTT_TOPIC.replace(":clientId", CLIENT_ID)
    .replace(":experimentId", experimentId)
    .replace(":protocolName", protocolName);
}

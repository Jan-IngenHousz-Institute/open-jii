/**
 * Ingest topic prefix for a device publishing into an experiment. The canonical
 * channel is `experiment/data_ingest/v1/{experimentId}/{sensorType}/{sensorVersion}/{sensorId}`
 * (asyncapi.yaml); the platform owns the first two parameters and the device
 * appends the rest per measurement.
 */
export function buildIngestTopicPrefix(experimentId: string, deviceType: string): string {
  return `experiment/data_ingest/v1/${experimentId}/${deviceType}`;
}

/**
 * The retained topic carrying a device's current configuration
 * (`device/config/v1/{thingName}`, asyncapi.yaml). The platform publishes
 * retained at QoS 1; the device subscribes and acks on the `/ack` leaf.
 */
export function buildDeviceConfigTopic(thingName: string): string {
  return `device/config/v1/${thingName}`;
}

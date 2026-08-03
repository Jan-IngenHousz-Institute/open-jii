/**
 * Ingest topic prefix for a device publishing into an experiment. The canonical
 * channel is `experiment/data_ingest/v1/{experimentId}/{sensorType}/{sensorVersion}/{sensorId}/{protocolId}`
 * (asyncapi.yaml); the platform owns the first two parameters and the device
 * appends the rest per measurement.
 */
export function buildIngestTopicPrefix(experimentId: string, deviceType: string): string {
  return `experiment/data_ingest/v1/${experimentId}/${deviceType}`;
}

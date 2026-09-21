export const UPLOAD_CONCURRENCY = 8;
export const UPLOAD_RETRY_BACKOFF_MS = [1_000, 4_000, 15_000];

/**
 * AWS IoT Core refuses an MQTT message whose payload is larger than this, and
 * the limit is not adjustable. A measurement past it goes to S3 instead.
 */
export const MQTT_PAYLOAD_LIMIT_BYTES = 128 * 1024;

/**
 * Ceiling on a single S3 PUT. Longer than the shared `FETCH_TIMEOUT_MS`
 * because this request body is, by definition, the payloads too large for the
 * broker, and field connectivity is slow. Without it a stalled socket would
 * hold an outbox worker slot for the life of the process.
 */
export const LARGE_UPLOAD_TIMEOUT_MS = 60_000;

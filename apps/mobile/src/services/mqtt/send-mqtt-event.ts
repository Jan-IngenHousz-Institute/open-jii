import { createMqttConnection, ReceivedMessage } from "~/services/mqtt/create-mqtt-connection";

// paho-mqtt + the Cognito handshake can hang silently when the device is
// offline or AWS is throttling. Without a hard ceiling the caller's promise
// never settles, leaving the measurement in limbo (not saved, not failed).
const DEFAULT_TIMEOUT_MS = 15_000;

export async function sendMqttEvent(
  topic: string,
  payload: object,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
) {
  const emitter = await createMqttConnection();
  await emitter.emit("sendMessage", {
    topic,
    payload: JSON.stringify(payload),
  });

  const resultPromise = new Promise<ReceivedMessage>((resolve, reject) => {
    emitter.on("messageDelivered", (message) => {
      resolve(message);
    });
    emitter.on("connectionLost", (error) => reject(new Error(error.errorMessage)));
  });

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error(`MQTT publish timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });

  try {
    await Promise.race([resultPromise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    emitter.emit("destroy").catch((e) => console.log("connection already destroyed", e));
  }

  return resultPromise;
}

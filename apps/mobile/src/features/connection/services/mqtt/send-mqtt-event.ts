import {
  createMqttConnection,
  ReceivedMessage,
} from "~/features/connection/services/mqtt/create-mqtt-connection";

// paho-mqtt + the Cognito handshake can hang silently when AWS is throttling
// or the network is flapping. Without a hard ceiling the caller's promise
// never settles, blocking the UI on a row that's already saved as "pending".
const DEFAULT_TIMEOUT_MS = 15_000;

const CONNECT_TIMEOUT_MS = 10_000;

export async function sendMqttEvent(
  topic: string,
  payload: object,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
) {
  console.log("[mqtt] sendMqttEvent: start", { topic });

  const connectPromise = createMqttConnection();
  let connectTimeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const connectTimeoutPromise = new Promise<never>((_, reject) => {
    connectTimeoutHandle = setTimeout(
      () => reject(new Error(`MQTT connect timed out after ${CONNECT_TIMEOUT_MS}ms`)),
      CONNECT_TIMEOUT_MS,
    );
  });

  let emitter: Awaited<ReturnType<typeof createMqttConnection>>;
  try {
    emitter = await Promise.race([connectPromise, connectTimeoutPromise]);
  } finally {
    if (connectTimeoutHandle) clearTimeout(connectTimeoutHandle);
  }
  console.log("[mqtt] sendMqttEvent: connection ready");

  const serialized = JSON.stringify(payload);
  console.log("[mqtt] sendMqttEvent: payload serialized", { bytes: serialized.length });

  const resultPromise = new Promise<ReceivedMessage>((resolve, reject) => {
    emitter.on("messageDelivered", (message) => {
      console.log("[mqtt] sendMqttEvent: messageDelivered");
      resolve(message);
    });
    emitter.on("connectionLost", (error) => {
      console.log("[mqtt] sendMqttEvent: connectionLost", error?.errorMessage);
      reject(new Error(error.errorMessage));
    });
  });

  await emitter.emit("sendMessage", {
    topic,
    payload: serialized,
  });
  console.log("[mqtt] sendMqttEvent: sendMessage emitted");

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error(`MQTT publish timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });

  try {
    await Promise.race([resultPromise, timeoutPromise]);
    console.log("[mqtt] sendMqttEvent: race resolved");
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    emitter.emit("destroy").catch((e) => console.log("connection already destroyed", e));
  }

  return resultPromise;
}

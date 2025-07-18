import { createMqttConnection, ReceivedMessage } from "~/services/mqtt/create-mqtt-connection";

export async function sendMqttEvent(topic: string, payload: object) {
  const emitter = await createMqttConnection();
  await emitter.emit("sendMessage", {
    topic,
    payload: JSON.stringify(payload),
  });

  const resultPromise = new Promise<ReceivedMessage>((resolve, reject) => {
    emitter.on("messageDelivered", (message) => {
      console.log("message delivered to topic", topic);
      resolve(message);
    });
    emitter.on("connectionLost", (error) => reject(new Error(error.errorMessage)));
  });

  try {
    await resultPromise;
  } finally {
    emitter.emit("destroy").catch((e) => console.log("connection already destroyed", e));
  }

  return resultPromise;
}

import { createMqttConnection, ReceivedMessage } from "~/services/mqtt/create-mqtt-connection";

export async function sendMqttEvent(topic: string, payload: object) {
  const emitter = await createMqttConnection()
  await emitter.emit('sendMessage', { topic, payload: JSON.stringify(payload) })

  const resultPromise = new Promise<ReceivedMessage>((resolve, reject) => {
    emitter.on('messageDelivered', (message) => {
      console.log('message delivered!');
      resolve(message)
    })
    emitter.on('connectionLost', (error) => reject(error))
  })

  try {
    await resultPromise
  } finally {
    emitter.emit('destroy')
      .catch((e) => console.log('connection already destroyed', e))
  }

  return resultPromise;
}

import { useAsync } from "react-async-hook";

import { createMqttConnection } from "../services/mqtt/mqtt";

export function MqttPublishTestScreen() {
  useAsync(async () => {
    try {
      await createMqttConnection();
    } catch (e) {
      console.log("error", e);
    }
  }, []);

  return null;
}

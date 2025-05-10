import { useAsync } from "react-async-hook";

import { mqttTest } from "../services/mqtt/mqtt";

export function MqttPublishTestScreen() {
  useAsync(async () => {
    try {
      await mqttTest();
    } catch (e) {
      console.log("error", e);
    }
  }, []);

  return null;
}

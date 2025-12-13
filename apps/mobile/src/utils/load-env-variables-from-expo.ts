import { EnvVariablesMap } from "~/types/env-variables";

function get(key: string): string {
  const publicKey = "EXPO_PUBLIC_" + key;
  const value = process.env[key] ?? process.env[publicKey];

  if (!value) {
    throw new Error(`Missing environment variable: ${key} or ${publicKey}`);
  }

  return value;
}

export function loadEnvVariablesFromExpo(): EnvVariablesMap {
  return {
    prod: {
      REGION: get("PROD_REGION"),
      IDENTITY_POOL_ID: get("PROD_IDENTITY_POOL_ID"),
      IOT_ENDPOINT: get("PROD_IOT_ENDPOINT"),
      CLIENT_ID: get("PROD_CLIENT_ID"),
      MQTT_TOPIC: get("PROD_MQTT_TOPIC"),
      NEXT_AUTH_URI: get("PROD_NEXT_AUTH_URI"),
      BACKEND_URI: get("PROD_BACKEND_URI"),
    },
    dev: {
      REGION: get("DEV_REGION"),
      IDENTITY_POOL_ID: get("DEV_IDENTITY_POOL_ID"),
      IOT_ENDPOINT: get("DEV_IOT_ENDPOINT"),
      CLIENT_ID: get("DEV_CLIENT_ID"),
      MQTT_TOPIC: get("DEV_MQTT_TOPIC"),
      NEXT_AUTH_URI: get("DEV_NEXT_AUTH_URI"),
      BACKEND_URI: get("DEV_BACKEND_URI"),
    },
  };
}

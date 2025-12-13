import { EnvVariablesMap } from "~/types/env-variables";

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export function loadEnvVariablesFromExpo(): EnvVariablesMap {
  return {
    prod: {
      REGION: required(process.env.EXPO_PUBLIC_PROD_REGION, "EXPO_PUBLIC_PROD_REGION"),
      IDENTITY_POOL_ID: required(
        process.env.EXPO_PUBLIC_PROD_IDENTITY_POOL_ID,
        "EXPO_PUBLIC_PROD_IDENTITY_POOL_ID",
      ),
      IOT_ENDPOINT: required(
        process.env.EXPO_PUBLIC_PROD_IOT_ENDPOINT,
        "EXPO_PUBLIC_PROD_IOT_ENDPOINT",
      ),
      CLIENT_ID: required(process.env.EXPO_PUBLIC_PROD_CLIENT_ID, "EXPO_PUBLIC_PROD_CLIENT_ID"),
      MQTT_TOPIC: required(process.env.EXPO_PUBLIC_PROD_MQTT_TOPIC, "EXPO_PUBLIC_PROD_MQTT_TOPIC"),
      NEXT_AUTH_URI: required(
        process.env.EXPO_PUBLIC_PROD_NEXT_AUTH_URI,
        "EXPO_PUBLIC_PROD_NEXT_AUTH_URI",
      ),
      BACKEND_URI: required(
        process.env.EXPO_PUBLIC_PROD_BACKEND_URI,
        "EXPO_PUBLIC_PROD_BACKEND_URI",
      ),
    },

    dev: {
      REGION: required(process.env.EXPO_PUBLIC_DEV_REGION, "EXPO_PUBLIC_DEV_REGION"),
      IDENTITY_POOL_ID: required(
        process.env.EXPO_PUBLIC_DEV_IDENTITY_POOL_ID,
        "EXPO_PUBLIC_DEV_IDENTITY_POOL_ID",
      ),
      IOT_ENDPOINT: required(
        process.env.EXPO_PUBLIC_DEV_IOT_ENDPOINT,
        "EXPO_PUBLIC_DEV_IOT_ENDPOINT",
      ),
      CLIENT_ID: required(process.env.EXPO_PUBLIC_DEV_CLIENT_ID, "EXPO_PUBLIC_DEV_CLIENT_ID"),
      MQTT_TOPIC: required(process.env.EXPO_PUBLIC_DEV_MQTT_TOPIC, "EXPO_PUBLIC_DEV_MQTT_TOPIC"),
      NEXT_AUTH_URI: required(
        process.env.EXPO_PUBLIC_DEV_NEXT_AUTH_URI,
        "EXPO_PUBLIC_DEV_NEXT_AUTH_URI",
      ),
      BACKEND_URI: required(process.env.EXPO_PUBLIC_DEV_BACKEND_URI, "EXPO_PUBLIC_DEV_BACKEND_URI"),
    },
  };
}

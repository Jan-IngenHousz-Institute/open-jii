export interface EnvVariables {
  REGION: string;
  IDENTITY_POOL_ID: string;
  IOT_ENDPOINT: string;
  CLIENT_ID: string;
  MQTT_TOPIC: string;
  NEXT_AUTH_URI: string;
  BACKEND_URI: string;
  POSTHOG_API_KEY: string;
}

export type EnvVariablesMap = Record<string, EnvVariables>;

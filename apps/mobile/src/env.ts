import { EnvVariablesMap } from "~/types/env-variables";

export const env: EnvVariablesMap = {
  prod: {
    REGION: "eu-central-1",
    IDENTITY_POOL_ID: "eu-central-1:da054ca6-982b-4da2-805e-74ca7f16d0b3",
    IOT_ENDPOINT: "a3qrmjf5m5y241-ats.iot.eu-central-1.amazonaws.com",
    CLIENT_ID: "multispeq_test_interface_mobile",
    MQTT_TOPIC: "experiment/data_ingest/v1/:experimentId/multispeq/v1.0/:clientId/:protocolId",
    NEXT_AUTH_URI: "https://openjii.org",
    BACKEND_URI: "https://api.openjii.org",
  },
  dev: {
    REGION: "eu-central-1",
    IDENTITY_POOL_ID: "eu-central-1:5cadd096-bb7d-4340-8c99-8cfa553f253d",
    IOT_ENDPOINT: "a2s5vvyojsnl53-ats.iot.eu-central-1.amazonaws.com",
    CLIENT_ID: "multispeq_test_interface_mobile",
    MQTT_TOPIC: "experiment/data_ingest/v1/:experimentId/multispeq/v1.0/:clientId/:protocolId",
    NEXT_AUTH_URI: "https://dev.openjii.org",
    BACKEND_URI: "https://api.dev.openjii.org",
  },
};

"use strict";

const { IoTDataPlaneClient, PublishCommand } = require("@aws-sdk/client-iot-data-plane");

// The data plane has one endpoint per account, which a client must be pointed at. One attempt,
// so a retried publish never carries an old sent_at.
const iot = new IoTDataPlaneClient({ endpoint: process.env.IOT_DATA_ENDPOINT, maxAttempts: 1 });

exports.handler = async () => {
  // A defaulted value would label every message with the wrong environment, or publish to a
  // topic the rule never selects.
  const { ENVIRONMENT: environment, IOT_DATA_ENDPOINT: endpoint, TOPIC: topic } = process.env;
  if (!environment || !endpoint || !topic) {
    throw new Error("ENVIRONMENT, IOT_DATA_ENDPOINT and TOPIC are required");
  }

  await iot.send(
    new PublishCommand({
      topic,
      qos: 1,
      payload: Buffer.from(JSON.stringify({ healthcheck: true, sent_at: Date.now(), environment })),
    }),
  );
};

"use strict";

const https = require("https");
const http = require("http");

const BACKEND_URL = process.env.BACKEND_URL ?? "";
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? "";

exports.handler = async (event) => {
  const { SerialNumber, DeviceClass } = event.parameters ?? {};

  console.log(JSON.stringify({
    msg: "Pre-provisioning hook invoked",
    serialNumber: SerialNumber,
    deviceClass: DeviceClass,
    clientId: event.clientId,
  }));

  if (!SerialNumber || !DeviceClass) {
    console.error(JSON.stringify({ msg: "Missing required parameters", event }));
    return { allowProvisioning: false };
  }

  try {
    const response = await callBackend({
      serialNumber: SerialNumber,
      deviceClass: DeviceClass,
      certificateId: event.certificateId,
    });

    console.log(JSON.stringify({
      msg: "Backend validation result",
      allowed: response.allowed,
      reason: response.reason,
      serialNumber: SerialNumber,
    }));

    if (!response.allowed) {
      return { allowProvisioning: false };
    }

    return {
      allowProvisioning: true,
      parameterOverrides: {
        ThingName: `${DeviceClass}-${SerialNumber}`,
      },
    };
  } catch (error) {
    console.error(JSON.stringify({ msg: "Backend validation failed", error: String(error) }));
    return { allowProvisioning: false };
  }
};

function callBackend(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(`${BACKEND_URL}/api/v1/iot-devices/validate`);
    const isHttps = url.protocol === "https:";
    const transport = isHttps ? https : http;

    const req = transport.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
          "x-internal-api-key": INTERNAL_API_KEY,
        },
        timeout: 4000,
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk) => { responseBody += chunk; });
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`Backend returned ${res.statusCode}: ${responseBody}`));
            return;
          }
          resolve(JSON.parse(responseBody));
        });
      },
    );

    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timeout")); });
    req.write(data);
    req.end();
  });
}

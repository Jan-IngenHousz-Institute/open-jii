
    const schema = {
  "asyncapi": "2.0.0",
  "info": {
    "title": "OpenJII MQTT API (AWS IoT Core)",
    "version": "1.0.0",
    "description": "This AsyncAPI specification defines the MQTT topics and message schemas for AWS IoT Core. It details channels for device status updates and sensor data, allowing devices to publish their state and sensor readings securely.\n",
    "contact": {
      "name": "OpenJII",
      "email": "ji-institute@info.nl"
    },
    "license": {
      "name": "GNU General Public License",
      "url": "https://www.gnu.org/licenses/gpl-3.0.html"
    }
  },
  "servers": {
    "production": {
      "url": "a123456789.iot.us-east-1.amazonaws.com",
      "protocol": "mqtt",
      "description": "AWS IoT Core production endpoint"
    }
  },
  "channels": {
    "devices/{deviceId}/status": {
      "description": "This channel is used for receiving device status updates. Devices publish messages indicating their current operational status (e.g., online, offline, error).\n",
      "parameters": {
        "deviceId": {
          "description": "Unique identifier for the device.",
          "schema": {
            "type": "string",
            "x-parser-schema-id": "deviceId"
          }
        }
      },
      "subscribe": {
        "operationId": "onDeviceStatusUpdate",
        "summary": "Handle incoming device status updates.",
        "message": {
          "contentType": "application/json",
          "name": "DeviceStatusMessage",
          "title": "Device Status Update",
          "summary": "A message sent by a device to indicate its status.",
          "payload": {
            "type": "object",
            "properties": {
              "deviceId": {
                "type": "string",
                "description": "The unique identifier of the device.",
                "x-parser-schema-id": "<anonymous-schema-2>"
              },
              "status": {
                "type": "string",
                "description": "The current status of the device (e.g., online, offline, error).",
                "x-parser-schema-id": "<anonymous-schema-3>"
              }
            },
            "required": [
              "deviceId",
              "status"
            ],
            "x-parser-schema-id": "<anonymous-schema-1>"
          },
          "examples": [
            {
              "payload": {
                "deviceId": "device123",
                "status": "online"
              }
            }
          ]
        }
      }
    },
    "devices/{deviceId}/data": {
      "description": "This channel receives sensor data from devices. Devices publish readings such as temperature and humidity.\n",
      "parameters": {
        "deviceId": {
          "description": "Unique identifier for the device.",
          "schema": {
            "type": "string",
            "x-parser-schema-id": "deviceId"
          }
        }
      },
      "subscribe": {
        "operationId": "onDeviceSensorData",
        "summary": "Process incoming sensor data from devices.",
        "message": {
          "contentType": "application/json",
          "name": "DeviceSensorDataMessage",
          "title": "Device Sensor Data",
          "summary": "A message containing sensor readings from a device.",
          "payload": {
            "type": "object",
            "properties": {
              "deviceId": {
                "type": "string",
                "description": "The unique identifier of the device.",
                "x-parser-schema-id": "<anonymous-schema-5>"
              },
              "temperature": {
                "type": "number",
                "description": "Temperature reading in Celsius.",
                "x-parser-schema-id": "<anonymous-schema-6>"
              },
              "humidity": {
                "type": "number",
                "description": "Humidity percentage.",
                "x-parser-schema-id": "<anonymous-schema-7>"
              }
            },
            "required": [
              "deviceId",
              "temperature",
              "humidity"
            ],
            "x-parser-schema-id": "<anonymous-schema-4>"
          },
          "examples": [
            {
              "payload": {
                "deviceId": "device123",
                "temperature": 23.5,
                "humidity": 55
              }
            }
          ]
        }
      }
    }
  },
  "components": {
    "messages": {
      "DeviceStatusMessage": "$ref:$.channels.devices/{deviceId}/status.subscribe.message",
      "DeviceSensorDataMessage": "$ref:$.channels.devices/{deviceId}/data.subscribe.message"
    },
    "securitySchemes": {
      "sigv4": {
        "type": "apiKey",
        "in": "user",
        "description": "AWS Signature Version 4 is used to sign the MQTT connection requests to AWS IoT Core.\n"
      }
    }
  },
  "x-parser-spec-parsed": true,
  "x-parser-api-version": 3,
  "x-parser-spec-stringified": true
};
    const config = {"show":{"sidebar":true},"sidebar":{"showOperations":"byDefault"}};
    const appRoot = document.getElementById('root');
    AsyncApiStandalone.render(
        { schema, config, }, appRoot
    );
  
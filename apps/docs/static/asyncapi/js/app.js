
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
    "experiment/data/ingest/v1/{experimentId}/{sensorType}/v{sensorVersion}/{sensorId}/{protocolId}": {
      "description": "Channel for ingesting experiment sensor data.\nThe path parameters represent:\n<ul>\n  <li><strong>experimentId:</strong> Unique identifier of the experiment (e.g., exp123).</li>\n  <li><strong>sensorType:</strong> The type or family of sensor (e.g., MutlispeQ, Ambit...).</li>\n  <li><strong>sensorVersion:</strong> Sensor firmware/hardware revision (without the 'v' prefix, e.g., 1, 2.1).</li>\n  <li><strong>sensorId:</strong> Unique sensor identifier (UUID format recommended).</li>\n  <li><strong>protocolId:</strong> Unique identifier for the sampling or measurement protocol (e.g., protoA).</li>\n</ul>\n",
      "parameters": {
        "experimentId": {
          "description": "Unique identifier of the experiment (e.g., exp123).",
          "schema": {
            "type": "string",
            "x-parser-schema-id": "experimentId"
          }
        },
        "sensorType": {
          "description": "The type or family of sensor (e.g., MutlispeQ, Ambit...).",
          "schema": {
            "type": "string",
            "x-parser-schema-id": "sensorType"
          }
        },
        "sensorVersion": {
          "description": "Sensor firmware/hardware revision (without the 'v' prefix, e.g., 1, 2.1).",
          "schema": {
            "type": "string",
            "x-parser-schema-id": "sensorVersion"
          }
        },
        "sensorId": {
          "description": "Unique sensor identifier (UUID format recommended).",
          "schema": {
            "type": "string",
            "x-parser-schema-id": "sensorId"
          }
        },
        "protocolId": {
          "description": "Unique identifier for the sampling or measurement protocol (e.g., protoA).",
          "schema": {
            "type": "string",
            "x-parser-schema-id": "protocolId"
          }
        }
      },
      "subscribe": {
        "operationId": "ingestExperimentData",
        "summary": "Ingest experiment sensor data.",
        "message": {
          "contentType": "application/json",
          "name": "ExperimentDataMessage",
          "title": "Experiment Data Ingestion Message",
          "summary": "A message containing sensor data for an experiment.",
          "payload": {
            "type": "object",
            "properties": {
              "data": {
                "type": "object",
                "description": "Sensor data payload.",
                "additionalProperties": true,
                "x-parser-schema-id": "<anonymous-schema-2>"
              }
            },
            "required": [
              "data"
            ],
            "x-parser-schema-id": "<anonymous-schema-1>"
          },
          "examples": [
            {
              "payload": {
                "data": {
                  "moisture": 30.5,
                  "temperature": 22.1
                }
              }
            }
          ]
        }
      }
    }
  },
  "components": {
    "messages": {
      "ExperimentDataMessage": "$ref:$.channels.experiment/data/ingest/v1/{experimentId}/{sensorType}/v{sensorVersion}/{sensorId}/{protocolId}.subscribe.message"
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
  
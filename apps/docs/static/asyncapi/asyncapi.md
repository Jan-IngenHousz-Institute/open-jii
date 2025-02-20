# OpenJII MQTT API (AWS IoT Core) 1.0.0 documentation

* License: [GNU General Public License](https://www.gnu.org/licenses/gpl-3.0.html)
* Email support: [ji-institute@info.nl](mailto:ji-institute@info.nl)

This AsyncAPI specification defines the MQTT topics and message schemas for AWS IoT Core. It details channels for device status updates and sensor data, allowing devices to publish their state and sensor readings securely.


## Table of Contents

* [Servers](#servers)
  * [production](#production-server)
* [Operations](#operations)
  * [SUB experiment/data/ingest/v1/{experimentId}/{sensorType}/v{sensorVersion}/{sensorId}/{protocolId}](#sub-experimentdataingestv1experimentidsensortypevsensorversionsensoridprotocolid-operation)

## Servers

### `production` Server

* URL: `a123456789.iot.us-east-1.amazonaws.com`
* Protocol: `mqtt`

AWS IoT Core production endpoint


## Operations

### SUB `experiment/data/ingest/v1/{experimentId}/{sensorType}/v{sensorVersion}/{sensorId}/{protocolId}` Operation

*Ingest experiment sensor data.*

* Operation ID: `ingestExperimentData`

Channel for ingesting experiment sensor data.
The path parameters represent:
<ul>
  <li><strong>experimentId:</strong> Unique identifier of the experiment (e.g., exp123).</li>
  <li><strong>sensorType:</strong> The type or family of sensor (e.g., MutlispeQ, Ambit...).</li>
  <li><strong>sensorVersion:</strong> Sensor firmware/hardware revision (without the 'v' prefix, e.g., 1, 2.1).</li>
  <li><strong>sensorId:</strong> Unique sensor identifier (UUID format recommended).</li>
  <li><strong>protocolId:</strong> Unique identifier for the sampling or measurement protocol (e.g., protoA).</li>
</ul>


#### Parameters

| Name | Type | Description | Value | Constraints | Notes |
|---|---|---|---|---|---|
| experimentId | string | Unique identifier of the experiment (e.g., exp123). | - | - | **required** |
| sensorType | string | The type or family of sensor (e.g., MutlispeQ, Ambit...). | - | - | **required** |
| sensorVersion | string | Sensor firmware/hardware revision (without the 'v' prefix, e.g., 1, 2.1). | - | - | **required** |
| sensorId | string | Unique sensor identifier (UUID format recommended). | - | - | **required** |
| protocolId | string | Unique identifier for the sampling or measurement protocol (e.g., protoA). | - | - | **required** |


#### Message Experiment Data Ingestion Message `ExperimentDataMessage`

*A message containing sensor data for an experiment.*

* Content type: [application/json](https://www.iana.org/assignments/media-types/application/json)

##### Payload

| Name | Type | Description | Value | Constraints | Notes |
|---|---|---|---|---|---|
| (root) | object | - | - | - | **additional properties are allowed** |
| data | object | Sensor data payload. | - | - | **required**, **additional properties are allowed** |

> Examples of payload

```json
{
  "data": {
    "moisture": 30.5,
    "temperature": 22.1
  }
}
```




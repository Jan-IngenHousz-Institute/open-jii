# OpenJII MQTT API (AWS IoT Core) 1.0.0 documentation

* License: [GNU General Public License](https://www.gnu.org/licenses/gpl-3.0.html)
* Email support: [ji-institute@info.nl](mailto:ji-institute@info.nl)

This AsyncAPI specification defines the MQTT topics and message schemas for AWS IoT Core. It details channels for device status updates and sensor data, allowing devices to publish their state and sensor readings securely.


## Table of Contents

* [Servers](#servers)
  * [production](#production-server)
* [Operations](#operations)
  * [SUB devices/{deviceId}/status](#sub-devicesdeviceidstatus-operation)
  * [SUB devices/{deviceId}/data](#sub-devicesdeviceiddata-operation)

## Servers

### `production` Server

* URL: `a123456789.iot.us-east-1.amazonaws.com`
* Protocol: `mqtt`

AWS IoT Core production endpoint


## Operations

### SUB `devices/{deviceId}/status` Operation

*Handle incoming device status updates.*

* Operation ID: `onDeviceStatusUpdate`

This channel is used for receiving device status updates. Devices publish messages indicating their current operational status (e.g., online, offline, error).


#### Parameters

| Name | Type | Description | Value | Constraints | Notes |
|---|---|---|---|---|---|
| deviceId | string | Unique identifier for the device. | - | - | **required** |


#### Message Device Status Update `DeviceStatusMessage`

*A message sent by a device to indicate its status.*

* Content type: [application/json](https://www.iana.org/assignments/media-types/application/json)

##### Payload

| Name | Type | Description | Value | Constraints | Notes |
|---|---|---|---|---|---|
| (root) | object | - | - | - | **additional properties are allowed** |
| deviceId | string | The unique identifier of the device. | - | - | **required** |
| status | string | The current status of the device (e.g., online, offline, error). | - | - | **required** |

> Examples of payload

```json
{
  "deviceId": "device123",
  "status": "online"
}
```



### SUB `devices/{deviceId}/data` Operation

*Process incoming sensor data from devices.*

* Operation ID: `onDeviceSensorData`

This channel receives sensor data from devices. Devices publish readings such as temperature and humidity.


#### Parameters

| Name | Type | Description | Value | Constraints | Notes |
|---|---|---|---|---|---|
| deviceId | string | Unique identifier for the device. | - | - | **required** |


#### Message Device Sensor Data `DeviceSensorDataMessage`

*A message containing sensor readings from a device.*

* Content type: [application/json](https://www.iana.org/assignments/media-types/application/json)

##### Payload

| Name | Type | Description | Value | Constraints | Notes |
|---|---|---|---|---|---|
| (root) | object | - | - | - | **additional properties are allowed** |
| deviceId | string | The unique identifier of the device. | - | - | **required** |
| temperature | number | Temperature reading in Celsius. | - | - | **required** |
| humidity | number | Humidity percentage. | - | - | **required** |

> Examples of payload

```json
{
  "deviceId": "device123",
  "temperature": 23.5,
  "humidity": 55
}
```




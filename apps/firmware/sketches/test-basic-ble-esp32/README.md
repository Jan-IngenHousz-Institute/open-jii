# test-basic-ble-esp32

Test environmental sensor node for local development. Implements the **Generic Device Protocol** defined in [`@repo/iot`](../../../../packages/iot) over USB Serial and BLE.

> **Note:** This sketch is for local testing only — it is not intended for production use.

## Hardware

| Component                      | Model                         |
| ------------------------------ | ----------------------------- |
| **Board**                      | DFRobot FireBeetle 2 ESP32-S3 |
| **Temp / Humidity / Pressure** | BME280 (I²C)                  |
| **Ambient Light**              | BH1750 (I²C)                  |

### Wiring

| Signal  | ESP32-S3 Pin |
| ------- | ------------ |
| I²C SDA | GPIO 1       |
| I²C SCL | GPIO 2       |

Both sensors share the same I²C bus.

## Communication

| Transport      | Details                                      |
| -------------- | -------------------------------------------- |
| **USB Serial** | 115200 baud, newline-delimited JSON          |
| **BLE**        | Nordic UART Service (NUS), `__EOM__` framing |

BLE device name: `Open-JII Sensor`

## Protocol commands

All commands follow the Generic Device Protocol JSON format (`{"command":"<CMD>"}\n`).

| Command      | Description                                     |
| ------------ | ----------------------------------------------- |
| `INFO`       | Device metadata (ID, firmware version, sensors) |
| `DISCOVER`   | List available sensors and parameters           |
| `SET_CONFIG` | Configure measurement parameters                |
| `GET_CONFIG` | Retrieve current configuration                  |
| `RUN`        | Start a measurement                             |
| `STOP`       | Stop a running measurement                      |
| `GET_DATA`   | Retrieve measurement results                    |
| `RESET`      | Reset device state                              |
| `PING`       | Health check                                    |
| `DISCONNECT` | Graceful disconnect                             |

## Quick start

```bash
# From apps/firmware/
pnpm build --sketch test-basic-ble-esp32

# Or with PlatformIO directly
pio run -d sketches/test-basic-ble-esp32
pio run -d sketches/test-basic-ble-esp32 -t upload
pio device monitor --baud 115200
```

## Dependencies

| Library                 | Version                           |
| ----------------------- | --------------------------------- |
| Adafruit BME280 Library | ^2.2.4                            |
| BH1750 (claws)          | ^1.3.0                            |
| ArduinoJson             | ^7.2.1                            |
| ESP32 BLE Arduino       | bundled with espressif32 platform |

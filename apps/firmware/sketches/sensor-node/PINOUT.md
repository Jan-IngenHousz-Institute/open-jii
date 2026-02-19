# Sensor Node Pinout

## DFRobot FireBeetle 2 ESP32-S3 Board

### Physical Pin Layout

```
                          USB-C
                            ||
                            ||
     ┌──────────────────────────────────────┐
     │                                      │
     │        FireBeetle 2 ESP32-S3        │
     │                                      │
 GND │●                                  ● │ VCC (3.3V)
3V3  │●                                  ● │ GND
 NC  │●                                  ● │ IO43
IO44 │●                                  ● │ IO44
IO43 │●                                  ● │ IO1  ◄── SDA (BME280, BH1750)
IO42 │●                                  ● │ IO2  ◄── SCL (BME280, BH1750)
IO41 │●                                  ● │ IO42
IO40 │●                                  ● │ IO41
IO39 │●                                  ● │ IO40
IO38 │●                                  ● │ IO39
IO37 │●                                  ● │ IO38
IO36 │●                                  ● │ IO21
IO35 │●                                  ● │ IO47
IO0  │●                                  ● │ IO48
IO45 │●                                  ● │ IO35
IO46 │●                                  ● │ IO36
 NC  │●                                  ● │ IO37
RST  │●                                  ● │ EN
     │                                      │
     └──────────────────────────────────────┘
              ║                    ║
           [BAT+]                [BAT-]
```

### I2C Bus Configuration

| Signal | GPIO | Connected Devices |
| ------ | ---- | ----------------- |
| SDA    | 1    | BME280, BH1750    |
| SCL    | 2    | BME280, BH1750    |

**Pull-up resistors**: Internal (no external resistors needed)

### Sensor Connections

#### BME280 (Temperature, Humidity, Pressure)

```
BME280          ESP32-S3
------          --------
VCC    ───────► 3.3V
GND    ───────► GND
SDA    ───────► GPIO1
SCL    ───────► GPIO2
I2C Address: 0x76 or 0x77
```

#### BH1750 (Light Intensity)

```
BH1750          ESP32-S3
------          --------
VCC    ───────► 3.3V
GND    ───────► GND
SDA    ───────► GPIO1
SCL    ───────► GPIO2
I2C Address: 0x23
```

### Communication Interfaces

#### USB Serial (Programming & Debug)

- **Port**: USB-C connector
- **Baud Rate**: 115200
- **Driver**: CDC USB (no external USB-UART needed)
- **Config**: `ARDUINO_USB_CDC_ON_BOOT=1`

#### Bluetooth Low Energy (BLE)

- **Service**: Nordic UART Service (NUS)
- **UUIDs**:
  - Service: `6E400001-B5A3-F393-E0A9-E50E24DCCA9E`
  - RX Char: `6E400002-B5A3-F393-E0A9-E50E24DCCA9E`
  - TX Char: `6E400003-B5A3-F393-E0A9-E50E24DCCA9E`
- **MTU**: 512 bytes
- **Protocol**: Generic Device Protocol with `__EOM__` framing

### Power

| Rail | Voltage  | Source                  |
| ---- | -------- | ----------------------- |
| VCC  | 3.3V     | Onboard regulator       |
| VBAT | 3.7-4.2V | LiPo battery (optional) |
| USB  | 5V       | USB-C port              |

**Current Draw** (approximate):

- Deep sleep: ~10µA
- Active (no WiFi/BLE): ~30mA
- Active (BLE on): ~80mA
- WiFi active: ~120mA

### Pin Usage Summary

| Function   | Pin(s)   | Notes                           |
| ---------- | -------- | ------------------------------- |
| I2C SDA    | GPIO1    | Sensors: BME280, BH1750         |
| I2C SCL    | GPIO2    | Sensors: BME280, BH1750         |
| USB D-     | GPIO19   | Built-in USB (not exposed)      |
| USB D+     | GPIO20   | Built-in USB (not exposed)      |
| BLE        | Internal | Built-in radio                  |
| Status LED | Internal | Built-in RGB LED (if available) |

### Available GPIOs

The following GPIOs are **available** for expansion:

- GPIO0, GPIO35, GPIO36, GPIO37, GPIO38, GPIO39, GPIO40, GPIO41, GPIO42, GPIO43, GPIO44, GPIO45, GPIO46, GPIO47, GPIO48

**Reserved/In-Use**:

- GPIO1: I2C SDA
- GPIO2: I2C SCL
- GPIO19, GPIO20: USB (internal)

### Wiring Diagram (Simplified)

```
┌─────────────────┐
│   ESP32-S3      │
│  (FireBeetle)   │
│                 │
│  GPIO1  GPIO2   │
│   │       │     │
└───┼───────┼─────┘
    │       │
    │       │        I2C Bus (3.3V)
    ├───────┼────────────┐
    │       │            │
    │       │            │
┌───┴───────┴───┐   ┌────┴─────────┐
│   BME280      │   │   BH1750     │
│  (0x76/0x77)  │   │   (0x23)     │
└───────────────┘   └──────────────┘
 Temp/Hum/Press      Light Intensity
```

## Protocol Implementation

This sensor node implements the **Generic Device Protocol** for communication over both Serial and BLE.

### Supported Commands

| Command    | Description                                |
| ---------- | ------------------------------------------ |
| INFO       | Get device information (ID, type, version) |
| DISCOVER   | List available sensors                     |
| PING       | Check device connectivity                  |
| GET_DATA   | Read current sensor values                 |
| SET_CONFIG | Configure device settings                  |
| GET_CONFIG | Retrieve current configuration             |
| RUN        | Start continuous measurement               |
| STOP       | Stop continuous measurement                |
| RESET      | Soft reset device                          |
| DISCONNECT | Cleanly disconnect                         |

## Notes

1. **I2C Address Conflicts**: Both sensors have different addresses, so no conflicts
2. **Power Consumption**: BLE is more power-efficient than WiFi for battery operation
3. **USB CDC**: Automatically enabled on boot for serial communication
4. **BLE Connection**: Device name starts with "SensorNode\_" followed by MAC address

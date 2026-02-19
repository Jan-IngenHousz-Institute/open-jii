# @repo/firmware

PlatformIO workspace for Open-JII IoT device firmware. Each subdirectory in `sketches/` is a self-contained PlatformIO project targeting a specific board + sensor configuration.

## Structure

```
apps/firmware/
├── package.json                 ← monorepo scripts (build, upload, monitor)
├── README.md
└── sketches/                    ← firmware projects
    └── sensor-node/             ← ESP32-S3 + BME280 + BH1750
        ├── platformio.ini
        └── src/main.cpp
```

## Prerequisites

Install [PlatformIO](https://platformio.org/):

```bash
# Option A: VS Code extension
# Search "PlatformIO IDE" in Extensions

# Option B: CLI
brew install platformio
# or: pip install platformio
```

## Usage

From the monorepo root:

```bash
# Build the default sketch (sensor-node)
pnpm --filter @repo/firmware build

# Flash to a connected board
pnpm --filter @repo/firmware upload

# Open serial monitor (115200 baud)
pnpm --filter @repo/firmware monitor

# List connected devices
pnpm --filter @repo/firmware devices
```

Or from `apps/firmware/` directly:

```bash
# Build a specific sketch
pio run -d sketches/sensor-node

# Flash a specific sketch
pio run -d sketches/sensor-node -t upload

# Build all sketches
pnpm build:all
```

## Adding a new sketch

Create a new directory under `sketches/` with a `platformio.ini` and `src/main.cpp`:

```bash
mkdir -p sketches/my-project/src
```

Add a `platformio.ini` for your board:

```ini
[env:my-board]
platform = espressif32
board = dfrobot_firebeetle2_esp32s3
framework = arduino
monitor_speed = 115200
```

Add your `src/main.cpp` and build:

```bash
pio run -d sketches/my-project
```

## Sketches

### `sensor-node`

Environmental sensor node implementing the `@repo/iot` Generic Device Protocol over USB Serial.

- **Board:** DFRobot FireBeetle 2 ESP32-S3
- **Sensors:** BME280 (temp/humidity/pressure), BH1750 (light)
- **Protocol:** 115200 baud, newline-delimited JSON
- **Details:** See [sketches/sensor-node/](sketches/sensor-node/) and the `@repo/iot` package docs

# @repo/firmware

PlatformIO workspace for Open-JII IoT device firmware. Each subdirectory under `sketches/` is a self-contained [PlatformIO](https://platformio.org/) project targeting a specific board and sensor configuration.

## Prerequisites

Install [PlatformIO](https://platformio.org/):

```bash
# Option A: VS Code extension — search "PlatformIO IDE" in Extensions

# Option B: CLI
brew install platformio
# or: pip install platformio
```

## Usage

From the monorepo root:

```bash
pnpm --filter @repo/firmware build          # build all sketches
pnpm --filter @repo/firmware upload         # flash all sketches
pnpm --filter @repo/firmware monitor        # serial monitor (115200 baud)
pnpm --filter @repo/firmware devices        # list connected devices
```

From `apps/firmware/` directly:

```bash
pnpm build --sketch <name>    # build a specific sketch
pnpm build                    # build all sketches
pnpm upload --sketch <name>   # flash a specific sketch
pnpm monitor                  # serial monitor
pnpm test                     # PlatformIO unit tests
pnpm check                    # static analysis (cppcheck)
pnpm clean                    # remove .pio/ build dirs
```

Or with PlatformIO directly:

```bash
pio run -d sketches/<name>
pio run -d sketches/<name> -t upload
```

## Adding a new sketch

1. Initialize a new PlatformIO project under `sketches/`:

   ```bash
   pio project init -d sketches/my-project --board <board_id>
   ```

2. Add your firmware code in `sketches/my-project/src/main.cpp`.

3. Build & flash:

   ```bash
   pio run -d sketches/my-project
   pio run -d sketches/my-project -t upload
   ```

The build scripts automatically discover all `sketches/*/` directories — no extra configuration needed.

## Sketches

- [`test-basic-ble-esp32`](sketches/test-basic-ble-esp32/) — Test BLE sensor node for local development (ESP32-S3 + BME280 + BH1750)

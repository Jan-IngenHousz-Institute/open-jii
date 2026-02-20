# @repo/iot

Platform-agnostic IoT device communication package for connecting to and controlling scientific instruments (MultispeQ, etc.) and IoT devices via Bluetooth and USB.

## Features

- 🔌 **Multiple Transports**: Bluetooth Classic, BLE, USB Serial
- 🌐 **Cross-Platform**: Works in React Native (iOS/Android) and Web (Chrome/Edge)
- 🔧 **Extensible**: Easy to add new device types and protocols
- 📦 **Type-Safe**: Full TypeScript support
- 🧪 **Testable**: Protocol logic independent of transport

## Architecture

```
Core Layer (platform-agnostic)
├── Device Protocol Interface
├── Transport Adapter Interface
└── Command Executor

Protocol Layer
└── MultispeQ Protocol Implementation

Adapter Layer (platform-specific)
├── Web Adapters (Web Bluetooth, Web Serial)
└── React Native Adapters (RN Bluetooth, RN BLE, RN USB)
```

## Usage

### Core (Shared)

```typescript
import { DeviceProtocol, TransportAdapter } from "@repo/iot";
```

### Web

```typescript
import { WebBluetoothAdapter, WebSerialAdapter } from "@repo/iot/web";
```

### React Native

```typescript
import { RNBluetoothAdapter, RNBLEAdapter, RNUSBAdapter } from "@repo/iot/react-native";
```

## Peer Dependencies

Platform-specific dependencies are optional peer dependencies:

- `react-native-bluetooth-classic` (React Native only)
- `react-native-ble-plx` (React Native only)
- `react-native-usb-serialport-for-android` (React Native Android only)

Web APIs (Web Bluetooth, Web Serial) are built-in to modern browsers.

import type { BluetoothDevice } from "react-native-bluetooth-classic";

const PROBE_TIMEOUT_MS = 3000;

// MultispeQ replies are framed as `<json><8-char-checksum>`; see
// bluetooth-device-to-multispeq-stream.ts. The probe doesn't validate the
// checksum, only that the prefix parses as JSON.
const CHECKSUM_LENGTH = 8;

async function safeIsConnected(device: BluetoothDevice): Promise<boolean> {
  try {
    return await device.isConnected();
  } catch {
    return false;
  }
}

// Identify a MultispeQ by behaviour rather than name: open the SPP socket,
// send `hello`, and accept any JSON-shaped reply within the timeout. Devices
// with numeric or otherwise non-standard Bluetooth names (e.g. units relabelled
// to "1520", "1630") are caught here; non-MultispeQ devices either fail to
// connect, refuse the write, or never reply.
export async function probeIsMultispeq(device: BluetoothDevice): Promise<boolean> {
  const wasConnected = await safeIsConnected(device);
  let connectedByProbe = false;

  if (!wasConnected) {
    try {
      await device.connect();
      connectedByProbe = true;
    } catch {
      return false;
    }
  }

  try {
    const reply = await new Promise<string | null>((resolve) => {
      let settled = false;
      const finish = (value: string | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        subscription.remove();
        resolve(value);
      };

      const subscription = device.onDataReceived((event) => {
        if (typeof event.data !== "string") return;
        finish(event.data);
      });

      const timer = setTimeout(() => finish(null), PROBE_TIMEOUT_MS);

      device
        .write("hello\r\n")
        .then((ok) => {
          if (!ok) finish(null);
        })
        .catch(() => finish(null));
    });

    if (!reply) return false;

    try {
      JSON.parse(reply.slice(0, -CHECKSUM_LENGTH));
      return true;
    } catch {
      return false;
    }
  } finally {
    // Only tear down connections the probe itself opened; leaving an
    // already-active session intact avoids interrupting the user's device.
    if (connectedByProbe) {
      try {
        await device.disconnect();
      } catch {
        // ignored
      }
    }
  }
}

#!/bin/bash

# ADB Wi-Fi auto-connect script
# Automatically finds your phone's Wi-Fi IP and connects ADB wirelessly

set -e

echo "🔍 Detecting connected Android device..."
adb devices | grep -w "device" >/dev/null || {
  echo "❌ No active device found via USB. Please connect your phone with a cable first."
  exit 1
}

echo "📡 Getting device IP address..."
DEVICE_IP=$(adb shell ip route | awk '{print $9}' | tr -d '\r')

if [ -z "$DEVICE_IP" ]; then
  echo "⚠️  Could not determine IP automatically. Trying fallback method..."
  DEVICE_IP=$(adb shell ip addr show wlan0 | grep 'inet ' | awk '{print $2}' | cut -d'/' -f1 | tr -d '\r')
fi

if [ -z "$DEVICE_IP" ]; then
  echo "❌ Failed to get device IP. Make sure the device is connected to Wi-Fi."
  exit 1
fi

echo "📱 Device IP detected: $DEVICE_IP"

echo "🔁 Restarting ADB in TCP/IP mode (port 5555)..."
adb tcpip 5555

echo "🔗 Connecting to $DEVICE_IP:5555 ..."
adb connect "$DEVICE_IP:5555"

echo "✅ Checking connection..."
adb devices

echo "🎉 Done! Your device should now be connected wirelessly at $DEVICE_IP:5555"

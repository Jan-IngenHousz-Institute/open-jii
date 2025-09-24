import React from "react";
import { View, StyleSheet } from "react-native";
import { ConnectionTypeSelector } from "~/screens/measurement-screen/components/connection-type-selector";
import { DeviceType } from "~/types/device";

interface Props {
  selectedType: DeviceType | undefined;
  onSelectType: (type: DeviceType) => void;
}

export function ConnectionTypeRow({ selectedType, onSelectType }: Props) {
  return (
    <View style={styles.connectionTypeContainer}>
      <ConnectionTypeSelector
        type="bluetooth-classic"
        selected={selectedType === "bluetooth-classic"}
        onSelect={() => onSelectType("bluetooth-classic")}
      />
      {process.env.ENABLE_BLE && (
        <ConnectionTypeSelector
          type="ble"
          selected={selectedType === "ble"}
          onSelect={() => onSelectType("ble")}
        />
      )}
      <ConnectionTypeSelector
        type="usb"
        selected={selectedType === "usb"}
        onSelect={() => onSelectType("usb")}
      />
      <ConnectionTypeSelector
        type="mock-device"
        selected={selectedType === "mock-device"}
        onSelect={() => onSelectType("mock-device")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  connectionTypeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
});

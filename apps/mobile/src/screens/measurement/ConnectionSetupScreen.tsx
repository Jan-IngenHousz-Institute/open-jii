import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Toast } from "~/components/Toast";
import { ConnectionSetup } from "~/components/measurement/ConnectionSetup";
import { DeviceList } from "~/components/measurement/DeviceList";
import { colors } from "~/constants/colors";
import { useTheme } from "~/hooks/useTheme";

import { useMeasurementScreenLogic } from "./useMeasurementScreenLogic";

export function ConnectionSetupScreen() {
  const theme = useTheme();
  const logic = useMeasurementScreenLogic();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.isDark
            ? colors.dark.background
            : colors.light.background,
        },
      ]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ConnectionSetup
          selectedExperiment={logic.selectedExperiment}
          selectedConnectionType={logic.selectedConnectionType}
          mockExperiments={logic.mockExperiments}
          onSelectExperiment={logic.handleSelectExperiment}
          onSelectConnectionType={logic.handleSelectConnectionType}
          onScanForDevices={logic.handleScanForDevices}
          isScanning={logic.isScanning}
        />

        {logic.showDeviceList && (
          <DeviceList
            devices={logic.discoveredDevices}
            isScanning={logic.isScanning}
            onConnectToDevice={logic.handleConnectToDevice}
          />
        )}
      </ScrollView>

      <Toast
        visible={logic.toast.visible}
        message={logic.toast.message}
        type={logic.toast.type}
        onDismiss={() => logic.setToast({ ...logic.toast, visible: false })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});

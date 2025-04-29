import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet } from "react-native";

import { BluetoothClassicTestPage } from "./screens/bluetooth-classic-test-page";
import { DevicesListScreen } from "./screens/devices-list-screen/devices-list-screen";
import { SerialPortTestPage } from "./screens/devices-list-screen/serial-port-test-page";

export function App() {
  return (
    <SafeAreaView style={styles.container}>
      {/*<DevicesListScreen />*/}
      {/*<BluetoothClassicTestPage />*/}
      <SerialPortTestPage />
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});

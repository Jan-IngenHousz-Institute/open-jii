import type { ParamListBase } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";

import { BluetoothDeviceDetailsScreen } from "../screens/bluetooth-device-details-screen";
import { BluetoothDevicesListScreen } from "../screens/bluetooth-devices-list-screen/bluetooth-devices-list-screen";

export interface BluetoothStackParamList extends ParamListBase {
  DeviceList: undefined;
  DeviceDetails: { deviceId: string };
}

const Stack = createNativeStackNavigator<BluetoothStackParamList>();

export function BluetoothStackNavigator() {
  return (
    <SafeAreaView className="flex-1" edges={["top"]}>
      <Stack.Navigator id={undefined}>
        <Stack.Screen
          name="DeviceList"
          component={BluetoothDevicesListScreen}
          options={{ title: "Bluetooth Devices" }}
        />
        <Stack.Screen
          name="DeviceDetails"
          component={BluetoothDeviceDetailsScreen}
          options={{ title: "Device Connection" }}
        />
      </Stack.Navigator>
    </SafeAreaView>
  );
}

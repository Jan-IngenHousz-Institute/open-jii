import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { BluetoothDeviceDetailsScreen } from "../screens/bluetooth-device-details-screen";
import { BluetoothDevicesListScreen } from "../screens/bluetooth-devices-list-screen/bluetooth-devices-list-screen";

export type BluetoothStackParamList = {
  DeviceList: undefined;
  DeviceDetails: { deviceId: string };
};

const Stack = createNativeStackNavigator<BluetoothStackParamList>();

export function BluetoothStackNavigator() {
  return (
    <Stack.Navigator>
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
  );
}

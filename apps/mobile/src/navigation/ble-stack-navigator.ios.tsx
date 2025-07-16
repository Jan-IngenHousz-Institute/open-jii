import type { ParamListBase } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { BleConnectionScreen } from "~/screens/old-app/ble-connection-screen";
import { BleDevicesListScreen } from "~/screens/old-app/ble-devices-list-screen/ble-devices-list-screen";

export interface BleStackParamList extends ParamListBase {
  BleDeviceList: undefined;
  BleConnection: { deviceId: string };
}

const Stack = createNativeStackNavigator<BleStackParamList>();

export function BleStackNavigator() {
  return (
    <Stack.Navigator id={undefined}>
      <Stack.Screen
        name="BleDeviceList"
        component={BleDevicesListScreen}
        options={{ title: "BLE Devices" }}
      />
      <Stack.Screen
        name="BleConnection"
        component={BleConnectionScreen}
        options={{ title: "BLE Connection" }}
      />
    </Stack.Navigator>
  );
}

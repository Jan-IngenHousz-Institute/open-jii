import { ParamListBase } from "@react-navigation/native";

export interface BluetoothStackParamList extends ParamListBase {
  DeviceList: undefined;
  DeviceDetails: { deviceId: string };
}

export function BluetoothStackNavigator() {
  return null;
}

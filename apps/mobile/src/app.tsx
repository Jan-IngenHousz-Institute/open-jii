import { Ionicons } from "@expo/vector-icons";
import { Platform } from 'react-native';
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { HomeScreen } from "~/screens/home-screen";

import { ToastProvider } from "./components/toast-provider";
import { BluetoothStackNavigator } from "./navigation/bluetooth-stack-navigator";
import { SerialPortConnectionScreen } from "./screens/serial-port-connection-screen";
import {BleDevicesListScreen} from "~/screens/ble-devices-list-screen/ble-devices-list-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {BleStackNavigator} from "~/navigation/ble-stack-navigator";

const Tab = createBottomTabNavigator();

export function App() {
  function renderMainRouter() {
    if (Platform.OS === "ios") {
      return <BleStackNavigator />
    }

    return (
      <Tab.Navigator
        initialRouteName="Home"
        screenOptions={({ route }) => ({
          headerShown: true,
          tabBarIcon: ({ color, size }) => {
            const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
              Home: "home",
              Bluetooth: "bluetooth",
              Serial: "terminal",
              "BLE": 'pulse'
            };
            return (
              <Ionicons name={icons[route.name]} size={size} color={color} />
            );
          },
        })}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            tabBarLabel: "Home",
          }}
        />
        <Tab.Screen
          name="Bluetooth"
          component={BluetoothStackNavigator}
          options={{ tabBarLabel: "Bluetooth", headerShown: false }}
        />
        <Tab.Screen
          name="Serial"
          component={SerialPortConnectionScreen}
          options={{ tabBarLabel: "Serial Port" }}
        />
        <Tab.Screen
          name="BLE"
          component={BleStackNavigator}
          options={{ tabBarLabel: "Bluetooth LE", headerShown: false }}
        />
      </Tab.Navigator>
    )
  }

  return (
    <ToastProvider>
      <NavigationContainer>
        {renderMainRouter()}
        <StatusBar style="dark" backgroundColor="white" translucent={false} />
      </NavigationContainer>
    </ToastProvider>
  );
}

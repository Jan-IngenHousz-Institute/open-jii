import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";
import { ToastProvider } from "~/components/toast-provider";
import { BleStackNavigator } from "~/navigation/ble-stack-navigator";
import { HomeScreen } from "~/screens/home-screen";
import { SerialPortConnectionScreen } from "~/screens/serial-port-connection-screen";

import { BluetoothStackNavigator } from "./bluetooth-stack-navigator";

const Tab = createBottomTabNavigator();

export function MainRouter() {
  return (
    <ToastProvider>
      <NavigationContainer>
        <Tab.Navigator
          initialRouteName="Home"
          screenOptions={({ route }) => ({
            headerShown: true,
            tabBarIcon: ({ color, size }) => {
              const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
                Home: "home",
                Bluetooth: "bluetooth",
                Serial: "terminal",
                "Bluetooth Low Energy": "bluetooth",
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
          {Platform.OS === "android" && (
            <>
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
            </>
          )}
          {Platform.OS === "ios" && (
            <Tab.Screen
              name="Bluetooth Low Energy"
              component={BleStackNavigator}
              options={{ tabBarLabel: "BLE", headerShown: false }}
            />
          )}
        </Tab.Navigator>
        <StatusBar style="dark" backgroundColor="white" translucent={false} />
      </NavigationContainer>
    </ToastProvider>
  );
}

import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";

import { BluetoothStackNavigator } from "./navigation/bluetooth-stack";
import {HomeScreen} from "~/screens/home-screen";
import { ToastProvider } from "./components/toast-provider";
import { SerialPortConnectionScreen } from "./screens/serial-port-connection-screen";

const Tab = createBottomTabNavigator();

export function App() {
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
        </Tab.Navigator>
        <StatusBar style="auto" />
      </NavigationContainer>
    </ToastProvider>
  );
}

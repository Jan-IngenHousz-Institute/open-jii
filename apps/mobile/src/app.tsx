import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { BluetoothDevicesListScreen } from "./screens/bluetooth-devices-list-screen";
import { HomeScreen } from "./screens/home-screen";
import { SerialPortConnectionScreen } from "./screens/serial-port-connection-screen";

const Tab = createBottomTabNavigator();

export function App() {
  return (
    <SafeAreaProvider>
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
            component={BluetoothDevicesListScreen}
            options={{ tabBarLabel: "Bluetooth" }}
          />
          <Tab.Screen
            name="Serial"
            component={SerialPortConnectionScreen}
            options={{ tabBarLabel: "Serial Port" }}
          />
        </Tab.Navigator>
        <StatusBar style="auto" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

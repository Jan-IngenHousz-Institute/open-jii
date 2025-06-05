import { Ionicons } from "@expo/vector-icons";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { ParamListBase } from "@react-navigation/native";
import { Text, TouchableOpacity, View } from "react-native";
import { LoginWidget } from "~/widgets/login-widget";

interface RootTabParamList extends ParamListBase {
  Home: undefined;
  Bluetooth: undefined;
  Serial: undefined;
  Login: undefined;
}

export function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();

  return (
    <View className="flex-1 bg-white">
      {/* Top bar: Login / User info */}
      <View className="flex-row items-center justify-end p-4">
        <LoginWidget />
      </View>

      {/* Top half: Bluetooth Mode */}
      <TouchableOpacity
        activeOpacity={0.6}
        className="flex-1 items-center justify-center"
        onPress={() => navigation.navigate("Bluetooth")}
      >
        <View className="items-center">
          <Ionicons name="bluetooth" size={100} color="#3b82f6" />
          <Text className="mt-2 text-xl font-semibold text-blue-600">
            Bluetooth Mode
          </Text>
        </View>
      </TouchableOpacity>

      {/* Divider */}
      <View className="h-[1px] w-full bg-gray-300" />

      {/* Bottom half: Serial Port Mode */}
      <TouchableOpacity
        activeOpacity={0.6}
        className="flex-1 items-center justify-center"
        onPress={() => navigation.navigate("Serial")}
      >
        <View className="items-center">
          <Ionicons name="terminal" size={100} color="#10b981" />
          <Text className="mt-2 text-xl font-semibold text-green-600">
            Serial Port Mode
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

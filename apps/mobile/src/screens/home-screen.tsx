import { Ionicons } from "@expo/vector-icons";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { Text, TouchableOpacity, View } from "react-native";

type RootTabParamList = {
  Home: undefined;
  Bluetooth: undefined;
  Serial: undefined;
};

export function HomeScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();

  return (
    <View className="flex-1 bg-white">
      {/* Top half: Bluetooth Mode */}
      <TouchableOpacity
        activeOpacity={0.6}
        className="flex-1 justify-center items-center"
        onPress={() => navigation.navigate("Bluetooth")}
      >
        <View className="items-center">
          <Ionicons name="bluetooth" size={100} color="#3b82f6" />
          <Text className="text-xl mt-2 text-blue-600 font-semibold">
            Bluetooth Mode
          </Text>
        </View>
      </TouchableOpacity>

      {/* Full-width Divider */}
      <View className="h-[1px] bg-gray-300 w-full" />

      {/* Bottom half: Serial Port Mode */}
      <TouchableOpacity
        activeOpacity={0.6}
        className="flex-1 justify-center items-center"
        onPress={() => navigation.navigate("Serial")}
      >
        <View className="items-center">
          <Ionicons name="terminal" size={100} color="#10b981" />
          <Text className="text-xl mt-2 text-green-600 font-semibold">
            Serial Port Mode
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

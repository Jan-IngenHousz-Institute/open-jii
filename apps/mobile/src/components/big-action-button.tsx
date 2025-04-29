import { Text, TouchableOpacity } from "react-native";

export function BigActionButton({ onPress, text }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="w-full bg-blue-600 rounded-full py-6 mt-6 items-center shadow-lg active:opacity-80"
    >
      <Text className="text-white text-2xl font-bold">{text}</Text>
    </TouchableOpacity>
  );
}

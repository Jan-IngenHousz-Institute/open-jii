import { Text, TouchableOpacity } from "react-native";

export function BigActionButton({ onPress, text }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="mt-6 w-full items-center rounded-full bg-blue-600 py-6 shadow-lg active:opacity-80"
    >
      <Text className="text-2xl font-bold text-white">{text}</Text>
    </TouchableOpacity>
  );
}

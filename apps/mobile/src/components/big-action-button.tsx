import { Text, TouchableOpacity } from "react-native";
import clsx from "clsx";

export function BigActionButton({ onPress, text, disabled = false }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={clsx(
        "mt-6 w-full items-center rounded-full py-6 shadow-lg",
        disabled ? "bg-gray-400" : "bg-blue-600 active:opacity-80"
      )}
      disabled={disabled}
    >
      <Text className={clsx("text-2xl font-bold", disabled ? "text-gray-200" : "text-white")}>
        {text}
      </Text>
    </TouchableOpacity>
  );
}

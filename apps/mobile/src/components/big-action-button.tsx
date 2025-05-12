import { Text, TouchableOpacity, ActivityIndicator, View } from "react-native";
import clsx from "clsx";

export function BigActionButton({ onPress, text, disabled = false, loading = false }) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      className={clsx(
        "mt-6 w-full items-center justify-center rounded-full py-6 shadow-lg",
        isDisabled ? "bg-gray-400" : "bg-blue-600 active:opacity-80"
      )}
      disabled={isDisabled}
    >
      <View
        style={{ height: 30 }} // roughly matches text size and padding
        className="justify-center items-center"
      >
        {loading ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text className={clsx("text-2xl font-bold", isDisabled ? "text-gray-200" : "text-white")}>
            {text}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

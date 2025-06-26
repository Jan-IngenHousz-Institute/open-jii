import { cva } from "class-variance-authority";
import { Text, TouchableOpacity, ActivityIndicator, View } from "react-native";

const bigActionButton = cva("mt-6 w-full items-center justify-center rounded-full py-6 shadow-lg", {
  variants: {
    disabled: {
      true: "bg-gray-400",
      false: "bg-blue-600 active:opacity-80",
    },
  },
});

const buttonText = cva("text-2xl font-bold", {
  variants: {
    disabled: {
      true: "text-gray-200",
      false: "text-white",
    },
  },
});

export function BigActionButton({ onPress, text, disabled = false, loading = false }) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      className={bigActionButton({ disabled: isDisabled })}
      disabled={isDisabled}
    >
      <View style={{ height: 30 }} className="items-center justify-center">
        {loading ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text className={buttonText({ disabled: isDisabled })}>{text}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

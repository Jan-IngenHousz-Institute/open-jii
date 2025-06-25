import React from "react";
import { ScrollView, Text, View } from "react-native";

// temporary component to be replaced with a proper scan view
export function JSONViewer({ data, indent = 0 }) {
  const renderValue = (value: any, level: number) => {
    if (typeof value !== "object" || value === null) {
      return <Text className="w-full break-words text-sm text-gray-600">{String(value)}</Text>;
    }

    if (Array.isArray(value)) {
      return (
        <View className="my-1 w-full border-l border-gray-200 pl-4">
          {value.map((item, idx) => (
            <View key={idx} className="mb-1 w-full">
              {renderValue(item, level + 1)}
            </View>
          ))}
        </View>
      );
    }

    return (
      <View className="my-1 w-full border-l border-gray-300 pl-4">
        {Object.entries(value).map(([key, val], idx) => (
          <View key={idx} className="mb-1 w-full">
            <Text className="text-sm font-semibold text-gray-700">{key}:</Text>
            <View className="ml-2">{renderValue(val, level + 1)}</View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <ScrollView className="w-full flex-1 bg-white">
      <View className="w-full p-4">{renderValue(data, indent)}</View>
    </ScrollView>
  );
}

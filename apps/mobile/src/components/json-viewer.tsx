import React from "react";
import { ScrollView, Text, View } from "react-native";

// temporary component to be replaced with a proper scan view
export function JSONViewer({ data, indent = 0 }) {
  const renderValue = (value: any, level: number) => {
    if (typeof value !== "object" || value === null) {
      return (
        <Text className="text-sm text-gray-600 break-words w-full">
          {String(value)}
        </Text>
      );
    }

    if (Array.isArray(value)) {
      return (
        <View className="pl-4 border-l border-gray-200 my-1 w-full">
          {value.map((item, idx) => (
            <View key={idx} className="mb-1 w-full">
              {renderValue(item, level + 1)}
            </View>
          ))}
        </View>
      );
    }

    return (
      <View className="pl-4 border-l border-gray-300 my-1 w-full">
        {Object.entries(value).map(([key, val], idx) => (
          <View key={idx} className="mb-1 w-full">
            <Text className="text-sm text-gray-700 font-semibold">{key}:</Text>
            <View className="ml-2">{renderValue(val, level + 1)}</View>
          </View>
        ))}
      </View>
    );
  };

  return (
    <ScrollView className="flex-1 bg-white w-full">
      <View className="p-4 w-full">{renderValue(data, indent)}</View>
    </ScrollView>
  );
}

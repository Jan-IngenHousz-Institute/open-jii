import React from "react";
import { View } from "react-native";
import { supportedEnvsList, useEnvironmentStore } from "~/shared/stores/environment-store";
import { Dropdown } from "~/shared/ui/Dropdown";

export function EnvironmentSelector() {
  const { environment, setEnvironment } = useEnvironmentStore();

  return (
    <View className="w-full">
      <Dropdown
        label="Environment"
        options={supportedEnvsList.map((key) => ({ label: key, value: key }))}
        selectedValue={environment}
        onSelect={(value) => setEnvironment(value)}
        placeholder="Select environment"
      />
    </View>
  );
}

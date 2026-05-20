import { clsx } from "clsx";
import React from "react";
import { View } from "react-native";
import { supportedEnvsList, useEnvironmentStore } from "~/shared/stores/environment-store";
import { Dropdown } from "~/shared/ui/Dropdown";
import { useTheme } from "~/shared/ui/hooks/use-theme";

export function EnvironmentSelector() {
  const { classes } = useTheme();
  const { environment, setEnvironment } = useEnvironmentStore();

  return (
    <View className={clsx("w-full", classes.background)}>
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

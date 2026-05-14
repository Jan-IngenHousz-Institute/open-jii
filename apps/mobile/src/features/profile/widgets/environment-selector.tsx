import { clsx } from "clsx";
import React from "react";
import { View } from "react-native";
import { Dropdown } from "~/components/Dropdown";
import { useTheme } from "~/hooks/use-theme";
import { supportedEnvsList, useEnvironmentStore } from "~/stores/environment-store";

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

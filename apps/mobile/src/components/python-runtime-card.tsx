import clsx from "clsx";
import { Download, Trash2 } from "lucide-react-native";
import React, { useState } from "react";
import { Text, View } from "react-native";
import { showAlert } from "~/components/AlertDialog";
import { Button } from "~/components/Button";
import { colors } from "~/constants/colors";
import { useTheme } from "~/hooks/use-theme";
import {
  installPythonRuntime,
  uninstallPythonRuntime,
} from "~/services/python/python-runtime-installer";
import { usePythonRuntimeStore } from "~/stores/python-runtime-store";

const DOWNLOAD_SIZE_LABEL = "~100 MB";

export function PythonRuntimeCard() {
  const { classes } = useTheme();
  const state = usePythonRuntimeStore((s) => s.state);
  const progress = usePythonRuntimeStore((s) => s.progress);
  const error = usePythonRuntimeStore((s) => s.error);
  const [busy, setBusy] = useState(false);

  const handleInstall = async () => {
    setBusy(true);
    try {
      await installPythonRuntime();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showAlert("Install failed", message);
    } finally {
      setBusy(false);
    }
  };

  const handleUninstall = () => {
    setBusy(true);
    try {
      uninstallPythonRuntime();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showAlert("Remove failed", message);
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = (() => {
    if (state === "ready") return "Installed";
    if (state === "installing") return `Installing… ${Math.round(progress * 100)}%`;
    if (state === "failed") return "Install failed";
    return "Not installed";
  })();

  return (
    <View className={clsx("mb-6 rounded-xl p-4", classes.card)}>
      <Text className={clsx("mb-2 text-lg font-bold", classes.text)}>Python macro support</Text>
      <Text className={clsx("mb-4 text-sm leading-5", classes.textSecondary)}>
        Enables Python macros on this device by downloading Pyodide + numpy, pandas, and scipy (
        {DOWNLOAD_SIZE_LABEL}). Required once; runs offline afterwards.
      </Text>

      <View className="flex-row justify-between py-2">
        <Text className={clsx("text-sm", classes.textSecondary)}>Status</Text>
        <Text className={clsx("text-sm font-medium", classes.text)}>{statusLabel}</Text>
      </View>

      {state === "installing" ? (
        <View className="mb-3 mt-2 h-1.5 overflow-hidden rounded-sm bg-gray-200 dark:bg-gray-700">
          <View
            className="h-full bg-[#005e5e]"
            // Dynamic width can't be a Tailwind class (no AOT match), so this
            // single inline style is unavoidable.
            style={{ width: `${Math.max(2, progress * 100)}%` }}
          />
        </View>
      ) : null}

      {state === "failed" && error ? (
        <Text className="mb-3 mt-2 text-sm text-red-600 dark:text-red-400">{error}</Text>
      ) : null}

      <View className="mt-3">
        {state === "ready" ? (
          <Button
            title="Remove Python support"
            onPress={handleUninstall}
            variant="outline"
            isDisabled={busy}
            icon={<Trash2 size={16} color={colors.semantic.error} />}
            textStyle={{ color: colors.semantic.error }}
          />
        ) : (
          <Button
            title={
              state === "failed"
                ? `Retry download (${DOWNLOAD_SIZE_LABEL})`
                : `Download (${DOWNLOAD_SIZE_LABEL})`
            }
            onPress={handleInstall}
            variant="primary"
            isLoading={state === "installing" || busy}
            isDisabled={state === "installing" || busy}
            icon={<Download size={16} color="#fff" />}
          />
        )}
      </View>
    </View>
  );
}

import { Download, Trash2 } from "lucide-react-native";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { showAlert } from "~/components/AlertDialog";
import { Button } from "~/components/Button";
import { Card } from "~/components/Card";
import { colors } from "~/constants/colors";
import { useTheme } from "~/hooks/use-theme";
import {
  installPythonRuntime,
  uninstallPythonRuntime,
} from "~/services/python/python-runtime-installer";
import { usePythonRuntimeStore } from "~/stores/python-runtime-store";

const DOWNLOAD_SIZE_LABEL = "~100 MB";

export function PythonRuntimeCard() {
  const theme = useTheme();
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
    <Card style={styles.card}>
      <Text
        style={[
          styles.title,
          { color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface },
        ]}
      >
        Python macro support
      </Text>
      <Text
        style={[
          styles.body,
          { color: theme.isDark ? colors.dark.inactive : colors.light.inactive },
        ]}
      >
        Enables Python macros on this device by downloading Pyodide + numpy, pandas, and scipy (
        {DOWNLOAD_SIZE_LABEL}). Required once; runs offline afterwards.
      </Text>

      <View style={styles.row}>
        <Text
          style={[
            styles.statusLabel,
            { color: theme.isDark ? colors.dark.inactive : colors.light.inactive },
          ]}
        >
          Status
        </Text>
        <Text
          style={[
            styles.statusValue,
            { color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface },
          ]}
        >
          {statusLabel}
        </Text>
      </View>

      {state === "installing" ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(2, progress * 100)}%` }]} />
        </View>
      ) : null}

      {state === "failed" && error ? <Text style={styles.errorText}>{error}</Text> : null}

      {state === "ready" ? (
        <Button
          title="Remove Python support"
          onPress={handleUninstall}
          variant="outline"
          isDisabled={busy}
          icon={<Trash2 size={16} color={colors.semantic.error} />}
          style={styles.actionButton}
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
          style={styles.actionButton}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  statusLabel: {
    fontSize: 14,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#e5e7eb",
    overflow: "hidden",
    marginTop: 8,
    marginBottom: 12,
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary.dark,
  },
  errorText: {
    color: colors.semantic.error,
    fontSize: 13,
    marginTop: 8,
    marginBottom: 12,
  },
  actionButton: {
    marginTop: 12,
  },
});

import { cva } from "class-variance-authority";
import clsx from "clsx";
import { useCameraPermissions } from "expo-camera";
import { CameraOff, ShieldAlert } from "lucide-react-native";
import React from "react";
import { ActivityIndicator, Linking, Text, View } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { useTheme } from "~/shared/ui/hooks/use-theme";

const iconBadgeVariants = cva("h-20 w-20 items-center justify-center rounded-full border", {
  variants: {
    permanentlyDenied: {
      false: "bg-primary/10 border-primary",
      true: "bg-error/10 border-error",
    },
  },
  defaultVariants: {
    permanentlyDenied: false,
  },
});

type PermissionState = ReturnType<typeof useCameraPermissions>[0];
type RequestPermission = ReturnType<typeof useCameraPermissions>[1];

export interface CameraPermissionStateProps {
  permission: PermissionState;
  requestPermission: RequestPermission;
}

export function useCameraPermission() {
  return useCameraPermissions();
}

export function CameraPermissionState({
  permission,
  requestPermission,
}: CameraPermissionStateProps) {
  const { colors, classes } = useTheme();
  const { t } = useTranslation("measurementFlow");

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.onSurface} />
      </View>
    );
  }

  const permanentlyDenied = !permission.canAskAgain || permission.status === "denied";

  return (
    <View className="flex-1 items-center justify-center gap-6 px-8">
      <View className={iconBadgeVariants({ permanentlyDenied })}>
        {permanentlyDenied ? (
          <ShieldAlert size={40} color={colors.semantic.error} />
        ) : (
          <CameraOff size={40} color={colors.brand} />
        )}
      </View>

      <View className="items-center gap-2">
        <Text className={clsx("text-xl font-bold", classes.text)}>
          {permanentlyDenied
            ? t("measurementFlow:cameraPermission.deniedTitle")
            : t("measurementFlow:cameraPermission.requiredTitle")}
        </Text>
        <Text className={clsx("text-center text-sm leading-5", classes.textMuted)}>
          {permanentlyDenied
            ? t("measurementFlow:cameraPermission.deniedMessage")
            : t("measurementFlow:cameraPermission.requiredMessage")}
        </Text>
      </View>

      {!permanentlyDenied ? (
        <Button
          onPress={requestPermission}
          title={t("measurementFlow:cameraPermission.grant")}
          variant="primary"
        />
      ) : (
        <Button
          onPress={() => Linking.openSettings()}
          title={t("measurementFlow:cameraPermission.openSettings")}
          variant="outline"
        />
      )}
    </View>
  );
}

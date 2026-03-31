import { cva } from "class-variance-authority";
import clsx from "clsx";
import { useCameraPermissions } from "expo-camera";
import { CameraOff, ShieldAlert } from "lucide-react-native";
import React from "react";
import { ActivityIndicator, Linking, Text, View } from "react-native";
import { Button } from "~/components/Button";
import { useTheme } from "~/hooks/use-theme";

const iconBadgeVariants = cva("h-20 w-20 items-center justify-center rounded-full border", {
  variants: {
    permanentlyDenied: {
      false: "bg-[#E2FCFC] border-[#005E5E]",
      true: "bg-[#FFE5E5] border-[#DC2626]",
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

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.neutral.black} />
      </View>
    );
  }

  const permanentlyDenied = !permission.canAskAgain || permission.status === "denied";

  return (
    <View className="flex-1 items-center justify-center gap-6 px-8">
      <View className={iconBadgeVariants({ permanentlyDenied })}>
        {permanentlyDenied ? (
          <ShieldAlert size={40} color={"#DC2626"} />
        ) : (
          <CameraOff size={40} color={colors.primary.dark} />
        )}
      </View>

      <View className="items-center gap-2">
        <Text className={clsx("text-xl font-bold", classes.text)}>
          {permanentlyDenied ? "Permission disabled" : "Camera access required"}
        </Text>
        <Text className={clsx("text-center text-sm leading-5", classes.textMuted)}>
          {permanentlyDenied
            ? "Camera access has been permanently denied. Open your device settings to enable it for openJII."
            : "openJII needs access to your camera to scan QR codes."}
        </Text>
      </View>

      {!permanentlyDenied ? (
        <Button onPress={requestPermission} title="Grant permission" variant="primary" />
      ) : (
        <Button onPress={() => Linking.openSettings()} title="Open settings" variant="outline" />
      )}
    </View>
  );
}

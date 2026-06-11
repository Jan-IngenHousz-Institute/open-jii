import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { useQuery } from "@tanstack/react-query";
import { Bluetooth, ChevronDown, X } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import {
  useAllDevices,
  useConnectToDevice,
  useConnectedDevices,
} from "~/features/connection/hooks/use-device-connection";
import { useDeviceConnectionStore } from "~/features/connection/hooks/use-device-connection-store";
import { partitionDevices } from "~/features/connection/services/device-connection-manager/device-sort";
import {
  hasBluetoothPermission,
  requestBluetoothPermission,
} from "~/features/connection/services/request-bluetooth-permissions";
import { useDeviceSheetStore } from "~/features/connection/stores/use-device-sheet-store";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
import type { Device } from "~/shared/types/device";
import { Button } from "~/shared/ui/Button";
import { useTheme } from "~/shared/ui/hooks/use-theme";

import { ConnectedDeviceRow } from "./connected-device-row";
import { IconSync } from "./icon-sync";
import { NearbyDeviceRow } from "./nearby-device-row";

export function DeviceSheet() {
  const isOpen = useDeviceSheetStore((s) => s.isOpen);
  const close = useDeviceSheetStore((s) => s.close);
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();
  const { t } = useTranslation("connection");
  const sheetRef = useRef<BottomSheetModal>(null);

  const { data: connectedDevices = [] } = useConnectedDevices();
  const lastConnectedDevice = useDeviceConnectionStore((s) => s.lastConnectedDevice);
  const batteryLevel = useDeviceConnectionStore((s) => s.batteryLevel);
  const { data: nearbyDevices = [], refetch: refreshDevices, isFetching } = useAllDevices();
  const { connectToDevice, disconnectFromDevice, connectingDeviceId } = useConnectToDevice();

  const [showAllDevices, setShowAllDevices] = useState(false);
  const { data: bluetoothPermissionGranted = true, refetch: refreshBluetoothPermission } = useQuery(
    {
      queryKey: ["bluetooth-permission"],
      queryFn: hasBluetoothPermission,
      enabled: isOpen,
      networkMode: "always",
    },
  );
  // Already-connected devices are shown in the connected list above, not as
  // pairable nearby rows.
  const availableDevices = useMemo(() => {
    const connectedIds = new Set(connectedDevices.map((d) => d.id));
    return nearbyDevices.filter((d) => !connectedIds.has(d.id));
  }, [nearbyDevices, connectedDevices]);
  const { named, unnamed } = useMemo(() => partitionDevices(availableDevices), [availableDevices]);
  // When nothing has a friendly name (common: MultispeQs advertise as a MAC),
  // show every device directly instead of an empty list above "See more".
  const collapseUnnamed = named.length > 0 && !showAllDevices;
  const visibleDevices = collapseUnnamed ? named : [...named, ...unnamed];

  useEffect(() => {
    if (!isOpen) setShowAllDevices(false);
  }, [isOpen]);

  const handleAllowBluetooth = useCallback(async () => {
    const granted = await requestBluetoothPermission();
    if (granted) {
      void refreshBluetoothPermission();
      void refreshDevices();
    }
  }, [refreshBluetoothPermission, refreshDevices]);

  useEffect(() => {
    if (isOpen) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [isOpen]);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    [],
  );

  const handleConnect = async (device: Device) => {
    try {
      await connectToDevice(device);
    } catch {
      toast.error(t("setup.errorConnect"));
    }
  };

  const handleDisconnect = async (device: Device) => {
    try {
      await disconnectFromDevice(device);
    } catch {
      toast.error(t("setup.errorDisconnect"));
    }
  };

  const hasConnected = connectedDevices.length > 0;
  const primaryIsWired = hasConnected && connectedDevices[0].type !== "bluetooth-classic";

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      onDismiss={close}
      handleIndicatorStyle={{ backgroundColor: themeColors.inactive }}
      backgroundStyle={{ backgroundColor: themeColors.card }}
      stackBehavior="push"
    >
      <BottomSheetView className="bg-card gap-3 px-4" style={{ paddingBottom: insets.bottom + 16 }}>
        <View className="flex-row items-center justify-between">
          <Text className="text-on-surface" style={{ fontFamily: "Poppins-Bold", fontSize: 20 }}>
            {t("deviceSheet.title")}
          </Text>
          <Pressable onPress={close} hitSlop={8} className="p-1">
            <X size={22} color={themeColors.onSurface} />
          </Pressable>
        </View>

        {/* Connected devices */}
        {hasConnected ? (
          <View className="gap-2">
            {connectedDevices.length > 1 ? (
              <Text
                className="text-on-surface"
                style={{ fontFamily: "Poppins-Bold", fontSize: 14 }}
              >
                {t("deviceSheet.connectedCount", { count: connectedDevices.length })}
              </Text>
            ) : null}
            {connectedDevices.map((d, i) => (
              <ConnectedDeviceRow
                key={d.id}
                device={d}
                batteryLevel={i === 0 ? (batteryLevel ?? undefined) : undefined}
                onDisconnect={(dev) => void handleDisconnect(dev)}
              />
            ))}
            {primaryIsWired ? (
              <Text className="text-muted-body text-[12px]">{t("deviceSheet.addAnotherHint")}</Text>
            ) : null}
          </View>
        ) : (
          <View className="bg-card border-border rounded-2xl border p-3.5">
            <View className="flex-row items-center gap-3">
              <View
                className="h-12 w-12 items-center justify-center"
                style={{ borderRadius: 14, backgroundColor: "rgba(0,0,0,0.04)" }}
              >
                <Bluetooth size={22} color={themeColors.inactive} />
              </View>
              <View className="min-w-0 flex-1">
                {lastConnectedDevice ? (
                  <>
                    <Text
                      className="text-on-surface"
                      style={{ fontFamily: "Poppins-Bold", fontSize: 15 }}
                      numberOfLines={1}
                    >
                      {t("deviceSheet.reconnectTitle", { name: lastConnectedDevice.name })}
                    </Text>
                    <Text className="text-muted-body mt-0.5 text-[12px]" numberOfLines={1}>
                      {t("deviceSheet.reconnectSub")}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text
                      className="text-on-surface"
                      style={{ fontFamily: "Poppins-Bold", fontSize: 15 }}
                      numberOfLines={1}
                    >
                      {t("deviceSheet.noDeviceTitle")}
                    </Text>
                    <Text className="text-muted-body mt-0.5 text-[12px]" numberOfLines={2}>
                      {t("deviceSheet.noDeviceSub")}
                    </Text>
                  </>
                )}
              </View>
              {lastConnectedDevice ? (
                <Button
                  title={t("deviceSheet.reconnect")}
                  variant="primary"
                  size="sm"
                  onPress={() => void handleConnect(lastConnectedDevice)}
                  isLoading={connectingDeviceId === lastConnectedDevice.id}
                />
              ) : null}
            </View>
          </View>
        )}

        {/* Nearby devices section */}
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-on-surface" style={{ fontFamily: "Poppins-Bold", fontSize: 14 }}>
            {t("deviceSheet.nearbyTitle")}
          </Text>
          <Pressable
            onPress={() => refreshDevices()}
            disabled={isFetching}
            hitSlop={8}
            className="flex-row items-center gap-1.5"
          >
            <IconSync size={14} color={colors.jii.darkGreen} spinning={isFetching} />
            <Text className="text-primary text-[13px] font-bold">
              {isFetching ? t("deviceSheet.scanning") : t("deviceSheet.scan")}
            </Text>
          </Pressable>
        </View>

        {!bluetoothPermissionGranted ? (
          <View className="border-divider bg-card flex-row items-center gap-3 rounded-2xl border p-3.5">
            <View
              className="h-10 w-10 items-center justify-center"
              style={{ borderRadius: 12, backgroundColor: "rgba(0,0,0,0.04)" }}
            >
              <Bluetooth size={20} color={themeColors.inactive} />
            </View>
            <View className="min-w-0 flex-1">
              <Text
                className="text-on-surface"
                style={{ fontFamily: "Poppins-Bold", fontSize: 14 }}
              >
                {t("deviceSheet.permissionHeading")}
              </Text>
              <Text className="text-muted-body mt-0.5 text-[12px]" numberOfLines={2}>
                {t("deviceSheet.permissionExplainer")}
              </Text>
            </View>
            <Button
              title={t("deviceSheet.allowBluetooth")}
              variant="primary"
              size="sm"
              hitSlop={8}
              accessibilityLabel={t("deviceSheet.allowBluetooth")}
              onPress={() => void handleAllowBluetooth()}
            />
          </View>
        ) : null}

        <View className="border-divider bg-card rounded-2xl border px-3.5">
          {availableDevices.length === 0 ? (
            <Text className="text-muted-body py-3 text-[13px]">{t("deviceList.empty")}</Text>
          ) : (
            <ScrollView style={{ maxHeight: 280 }}>
              {visibleDevices.map((d, i) => (
                <NearbyDeviceRow
                  key={d.id}
                  device={d}
                  isPairing={connectingDeviceId === d.id}
                  onPair={(dev) => void handleConnect(dev)}
                  isLast={i === visibleDevices.length - 1 && !collapseUnnamed}
                />
              ))}
              {collapseUnnamed && unnamed.length > 0 ? (
                <Pressable
                  onPress={() => setShowAllDevices(true)}
                  className="flex-row items-center justify-center gap-1.5 py-3"
                >
                  <ChevronDown size={16} color={themeColors.inactive} />
                  <Text className="text-muted-body text-[13px] font-semibold">
                    {t("deviceSheet.seeMoreDevices", { count: unnamed.length })}
                  </Text>
                </Pressable>
              ) : null}
            </ScrollView>
          )}
        </View>

        <Text className="text-muted-body mt-1 text-center text-[12px]">
          {t("deviceSheet.helperText")}
        </Text>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

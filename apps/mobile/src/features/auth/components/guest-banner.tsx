import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Modal, ScrollView, Text, View } from "react-native";
import { useLogout } from "~/features/auth/hooks/use-logout";
import { useSession } from "~/features/auth/hooks/use-session";
import { getOutbox } from "~/shared/composition/upload";
import { countMeasurementsByStatus, getMeasurementIds } from "~/shared/db/measurements-storage";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { useIsOnline } from "~/shared/ui/hooks/use-is-online";

export function GuestBanner() {
  const { user } = useSession();
  const { t } = useTranslation("auth");
  const logout = useLogout();
  const { data: online } = useIsOnline();
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<"upload" | "check">();
  const uploadIds = useRef(new Set<string>());
  const viewer = user?.id ? { userId: user.id, isGuest: true } : null;
  const counts = useQuery({
    queryKey: ["measurements", "counts", `${user?.id}:true`],
    queryFn: () => countMeasurementsByStatus(viewer),
    networkMode: "always",
    enabled: open,
    refetchInterval: open ? 1_000 : false,
  });
  const { refetch } = counts;
  useEffect(() => {
    if (!open) return;
    return getOutbox().subscribeSettled((items) => {
      for (const item of items) {
        if (!uploadIds.current.delete(item.id)) continue;
        if (item.status === "failed") setError("upload");
      }
      void refetch();
      if (uploadIds.current.size === 0) setUploading(false);
    });
  }, [open, refetch]);
  const unsent = (counts.data?.pending ?? 0) + (counts.data?.failed ?? 0);
  async function confirmLeave() {
    setPending(true);
    try {
      const current = await counts.refetch({ throwOnError: true });
      if ((current.data?.pending ?? 0) + (current.data?.failed ?? 0) > 0) setConfirmed(true);
      else await logout();
    } catch {
      setError("check");
    } finally {
      setPending(false);
    }
  }
  async function upload() {
    setUploading(true);
    setError(undefined);
    try {
      const ids = await getMeasurementIds(["pending", "failed"], viewer);
      uploadIds.current = new Set(ids);
      getOutbox().enqueueMany(ids);
      if (!ids.length) setUploading(false);
    } catch {
      setError("upload");
      setUploading(false);
    }
  }
  if (!user?.isAnonymous) return null;
  return (
    <View className="bg-surface border-border border-b px-4 pb-2 pt-3">
      <Text className="text-on-surface text-sm">{t("demo.banner", { name: user.name })}</Text>
      <Button
        title={t("demo.leave")}
        size="sm"
        variant="ghost"
        onPress={() => {
          setConfirmed(false);
          setError(undefined);
          setUploading(false);
          setOpen(true);
        }}
      />
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!pending) setOpen(false);
        }}
      >
        <View className="flex-1 justify-center bg-black/50 p-5">
          <ScrollView className="bg-background max-h-[85%] rounded-2xl p-5">
            <Text accessibilityRole="header" className="text-on-surface mb-4 text-xl font-bold">
              {t("demo.leaveTitle")}
            </Text>
            <Text className="text-on-surface mb-4">{t("demo.leaveDescription")}</Text>
            {confirmed && unsent > 0 && (
              <Text className="text-on-surface mb-4">{t("demo.unsent", { count: unsent })}</Text>
            )}
            {error && (
              <Text accessibilityRole="alert" className="text-error mb-4">
                {t(error === "check" ? "demo.leaveCheckError" : "demo.uploadError")}
              </Text>
            )}
            {uploading && unsent > 0 && (
              <Text accessibilityLiveRegion="polite" className="text-on-surface mb-4">
                {t("demo.uploading")}
              </Text>
            )}
            {confirmed && unsent > 0 && (
              <>
                <Button
                  title={t("demo.upload")}
                  isDisabled={online !== true || pending || uploading}
                  onPress={() => void upload()}
                />
                {online !== true && (
                  <Text className="text-on-surface my-2">{t("demo.uploadOffline")}</Text>
                )}
                <Button
                  title={t("demo.leaveAnyway")}
                  variant="outline"
                  isDisabled={pending}
                  onPress={() => {
                    setPending(true);
                    void logout().finally(() => setPending(false));
                  }}
                />
              </>
            )}
            {(!confirmed || unsent === 0) && (
              <Button
                title={t("demo.leave")}
                isDisabled={pending || counts.isPending}
                onPress={() => void confirmLeave()}
              />
            )}
            <Button
              title={t("demo.cancel")}
              variant="ghost"
              isDisabled={pending}
              onPress={() => setOpen(false)}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

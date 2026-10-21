import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Linking, Modal, ScrollView, Text, View } from "react-native";
import { getAuthClient } from "~/features/auth/services/auth";
import { acceptNewSession } from "~/features/auth/services/session-cache";
import { orpc } from "~/shared/api/orpc";
import { useTranslation } from "~/shared/i18n";
import { getEnvVar } from "~/shared/stores/environment-store";
import { Button } from "~/shared/ui/Button";
import { Input } from "~/shared/ui/Input";

import { zGuestName } from "@repo/api/shared/guest";

export function TryDemo({ online }: { online: boolean | undefined }) {
  const { t } = useTranslation("auth");
  const availability = useQuery(
    orpc.users.getDemoAvailability.queryOptions({
      enabled: online === true,
      retry: false,
      staleTime: 0,
    }),
  );
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const busy = useRef(false);
  const entry = useMutation({
    mutationFn: async () => {
      if (busy.current) return;
      const parsed = zGuestName.safeParse(name);
      if (!parsed.success || name.includes("@")) {
        setError(t("demo.invalidName"));
        return;
      }
      if (!online) {
        setError(t("demo.offline"));
        return;
      }
      busy.current = true;
      setError("");
      try {
        const sessionClient = getAuthClient();
        const existing = await sessionClient.getSession();
        if (existing.error || (existing.data && !existing.data.user.isAnonymous)) {
          setError(t("demo.entryError"));
          return;
        }
        let guestId = existing.data?.user.id;
        if (!guestId) {
          const result = await sessionClient.$fetch<{ user: { id: string } }>(
            "/sign-in/anonymous",
            { method: "POST", body: { name: parsed.data } },
          );
          if (result.error) {
            let context = "failed";
            if (result.error.status === 429) context = "limited";
            if ("code" in result.error && result.error.code === "DEMO_DISABLED")
              context = "disabled";
            setError(t("demo.entryError", { context }));
            return;
          }
          guestId = result.data?.user.id;
        }
        if (!guestId) {
          setError(t("demo.entryError"));
          return;
        }
        acceptNewSession(guestId);
      } catch {
        setError(t("demo.entryError"));
      } finally {
        busy.current = false;
      }
    },
  });
  if (!availability.data?.enabled && !open) return null;
  return (
    <View>
      <Button
        title={t("demo.try")}
        variant="outline"
        isDisabled={online !== true}
        onPress={() => setOpen(true)}
      />
      {online !== true && <Text className="text-on-surface">{t("demo.offline")}</Text>}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!busy.current) setOpen(false);
        }}
      >
        <View className="flex-1 justify-center bg-black/50 p-5">
          <ScrollView
            className="bg-background max-h-[85%] rounded-2xl p-5"
            keyboardShouldPersistTaps="handled"
          >
            <Text accessibilityRole="header" className="text-on-surface mb-4 text-xl font-bold">
              {t("demo.title")}
            </Text>
            <Text className="text-on-surface mb-4">{t("demo.permanent")}</Text>
            <Input
              label={t("demo.name")}
              accessibilityLabel={t("demo.name")}
              value={name}
              onChangeText={setName}
              editable={!entry.isPending}
              autoCapitalize="words"
            />
            <Text className="text-on-surface mb-4">{t("demo.nameHint")}</Text>
            <Text
              accessibilityRole="link"
              className="text-primary mb-4 underline"
              onPress={() =>
                void Linking.openURL(`${getEnvVar("NEXT_AUTH_URI")}/terms-and-conditions`)
              }
            >
              {t("demo.terms")}
            </Text>
            {!!error && (
              <Text accessibilityRole="alert" className="text-error mb-3">
                {error}
              </Text>
            )}
            <Button
              title={t("demo.continue")}
              isLoading={entry.isPending}
              isDisabled={entry.isPending || online !== true}
              onPress={() => entry.mutate()}
            />
            <Button
              title={t("demo.cancel")}
              variant="ghost"
              isDisabled={entry.isPending}
              onPress={() => setOpen(false)}
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

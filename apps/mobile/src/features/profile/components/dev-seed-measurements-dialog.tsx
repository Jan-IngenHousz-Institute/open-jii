import { useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { toast } from "sonner-native";
import { devSeedMeasurements } from "~/features/recent-measurements/services/dev-seed-measurements";
import { createLogger } from "~/shared/observability/logger";
import { Button } from "~/shared/ui/Button";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

const log = createLogger("dev-seed");

interface DevSeedMeasurementsDialogProps {
  visible: boolean;
  onClose: () => void;
}

export function DevSeedMeasurementsDialog({ visible, onClose }: DevSeedMeasurementsDialogProps) {
  const themeColors = useThemeColors();
  const queryClient = useQueryClient();
  const [countText, setCountText] = useState("10");
  const [isSeeding, setIsSeeding] = useState(false);

  const handleGenerate = async () => {
    // Strict: parseInt would accept "12abc" as 12. number-pad doesn't stop a
    // paste, so validate the whole string is digits with no leading zero.
    const trimmed = countText.trim();
    if (!/^[1-9]\d*$/.test(trimmed)) {
      toast.error("Enter a positive integer");
      return;
    }
    const count = Number(trimmed);
    setIsSeeding(true);
    try {
      const saved = await devSeedMeasurements(count);
      await queryClient.invalidateQueries({ queryKey: ["measurements"] });
      toast.success(`Seeded ${saved} measurement${saved === 1 ? "" : "s"}`);
      onClose();
    } catch (err) {
      log.error("seed failed", { err: (err as Error)?.message });
      toast.error("Failed to seed — see console");
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <Pressable className="flex-1 items-center justify-center bg-black/50" onPress={onClose}>
        <Pressable
          className="bg-card w-[85%] max-w-sm rounded-2xl p-4 pb-2.5"
          onPress={(e) => e.stopPropagation()}
        >
          <Text className="text-card-foreground mb-2 text-left text-lg font-semibold">
            Seed measurements (DEV)
          </Text>
          <Text className="text-card-foreground mb-3 text-left text-sm font-normal">
            Creates fake pending rows and enqueues them. Exercises queue + publisher without a real
            physical device.
          </Text>

          <View className="border-border bg-surface mb-4 flex-row items-center rounded-lg border">
            <TextInput
              className="text-on-surface flex-1 px-3 py-2.5 text-base"
              placeholderTextColor={themeColors.inactive}
              keyboardType="number-pad"
              value={countText}
              onChangeText={setCountText}
              placeholder="Count"
              autoFocus
              selectTextOnFocus
            />
          </View>

          <View className="gap-3.5">
            <Button
              title={isSeeding ? "Seeding…" : "Generate"}
              variant="primary"
              onPress={handleGenerate}
              isDisabled={isSeeding}
            />
            <Button title="Cancel" variant="ghost" onPress={onClose} isDisabled={isSeeding} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

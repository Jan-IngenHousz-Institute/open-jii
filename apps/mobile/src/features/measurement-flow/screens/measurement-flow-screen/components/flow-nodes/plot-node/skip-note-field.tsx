import React, { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { Input } from "~/shared/ui/Input";

interface SkipNoteFieldProps {
  plot: string;
  onSkip: (note: string | undefined) => void;
}

/** Other asks what happened, and the measurer may leave it empty. */
export function SkipNoteField({ plot, onSkip }: SkipNoteFieldProps) {
  const { t } = useTranslation("measurementFlow");
  const [note, setNote] = useState("");

  const handleSkip = () => onSkip(note.trim() || undefined);

  return (
    <View className="gap-2">
      <Input
        asBottomSheet
        label={t("measurementFlow:skipSheet.noteLabel")}
        placeholder={t("measurementFlow:skipSheet.notePlaceholder", { plot })}
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={200}
        containerStyle={{ marginBottom: 4 }}
      />
      <Button
        title={t("measurementFlow:skipSheet.skip", { plot })}
        onPress={handleSkip}
        size="lg"
      />
    </View>
  );
}

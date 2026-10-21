import { useTranslation } from "@repo/i18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";

import { UnitName } from "./unit-name";

interface LayoutGapConfirmProps {
  open: boolean;
  /** The measured plots the painting would remove. */
  names: readonly string[];
  levelName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Asked once before Mark gaps removes plots that already have readings. */
export function LayoutGapConfirm({
  open,
  names,
  levelName,
  onCancel,
  onConfirm,
}: LayoutGapConfirmProps) {
  const { t } = useTranslation("experiments");
  const unitName = new UnitName(levelName);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      onCancel();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("layout.gaps.confirmTitle", unitName.forCount(names.length))}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("layout.gaps.confirmBody", {
              ...unitName.forCount(names.length),
              names: names.join(", "),
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("layout.gaps.keep", { count: names.length })}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t("layout.gaps.confirm", unitName.forCount(names.length))}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

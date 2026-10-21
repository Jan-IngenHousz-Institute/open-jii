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

interface ReplacePaintedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/** Asks before a new order code recuts shares that were painted by hand. */
export function ReplacePaintedDialog({ open, onOpenChange, onConfirm }: ReplacePaintedDialogProps) {
  const { t } = useTranslation("fieldSessions");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("divide.replaceTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("divide.replaceDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("divide.replaceCancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{t("divide.replaceConfirm")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

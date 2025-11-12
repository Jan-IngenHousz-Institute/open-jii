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
} from "@repo/ui/components";

interface MemberDialogsProps {
  showLastAdminDialog: boolean;
  showLeaveConfirmDialog: boolean;
  showDemoteConfirmDialog: boolean;
  lastAdminAction: "leave" | "demote";
  onLastAdminDialogChange: (open: boolean) => void;
  onLeaveConfirmDialogChange: (open: boolean) => void;
  onDemoteConfirmDialogChange: (open: boolean) => void;
  onConfirmLeave: () => void;
  onConfirmDemote: () => void;
}

export function MemberDialogs({
  showLastAdminDialog,
  showLeaveConfirmDialog,
  showDemoteConfirmDialog,
  lastAdminAction,
  onLastAdminDialogChange,
  onLeaveConfirmDialogChange,
  onDemoteConfirmDialogChange,
  onConfirmLeave,
  onConfirmDemote,
}: MemberDialogsProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Last Admin Warning Dialog */}
      <AlertDialog open={showLastAdminDialog} onOpenChange={onLastAdminDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {lastAdminAction === "leave"
                ? t("experimentSettings.cannotLeaveAsLastAdmin")
                : t("experimentSettings.cannotDemoteAsLastAdmin")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {lastAdminAction === "leave"
                ? t("experimentSettings.lastAdminWarning")
                : t("experimentSettings.lastAdminDemoteWarning")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.ok")}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave Confirmation Dialog */}
      <AlertDialog open={showLeaveConfirmDialog} onOpenChange={onLeaveConfirmDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("experimentSettings.confirmLeaveTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("experimentSettings.confirmLeaveMessage")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmLeave}>
              {t("experimentSettings.confirmLeave")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Demote Confirmation Dialog */}
      <AlertDialog open={showDemoteConfirmDialog} onOpenChange={onDemoteConfirmDialogChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("experimentSettings.confirmDemoteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("experimentSettings.confirmDemoteMessage")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmDemote}>
              {t("experimentSettings.confirmDemote")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

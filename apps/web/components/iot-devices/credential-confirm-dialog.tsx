"use client";

import { Loader2 } from "lucide-react";

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

interface CredentialConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Amber disconnect line; omitted when nothing in scope is connected. */
  warning?: string;
  actionLabel: string;
  destructive?: boolean;
  pending: boolean;
  onConfirm: () => void;
}

/**
 * Confirmation shell shared by the device and group credential surfaces: the
 * dialog stays open while the mutation runs, so the action button carries the
 * pending state.
 */
export function CredentialConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  warning,
  actionLabel,
  destructive = false,
  pending,
  onConfirm,
}: CredentialConfirmDialogProps) {
  const { t: tCommon } = useTranslation("common");

  // Escape must not dismiss a running mutation's pending state.
  const handleOpenChange = (next: boolean) => {
    if (pending) {
      return;
    }
    onOpenChange(next);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
          {warning !== undefined && (
            <p className="text-status-stale-foreground text-sm font-medium">{warning}</p>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{tCommon("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            className={
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

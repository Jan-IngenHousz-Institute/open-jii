"use client";

import { IntentLink } from "@/components/navigation/intent-link/intent-link";
import { Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

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
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { toast } from "@repo/ui/hooks/use-toast";
import { cn } from "@repo/ui/lib/utils";

import { overviewTableText } from "./overview-table";

export interface RowActionsMenuLabels {
  trigger: string;
  edit: string;
  delete: string;
  deleteDescription: string;
  cancel: string;
  deleted: string;
}

interface RowActionsMenuProps {
  editHref: string;
  labels: RowActionsMenuLabels;
  /** Settles when the server answers; a rejection keeps the confirm dialog open. */
  onDelete: () => Promise<unknown>;
}

export function RowActionsMenu({ editHref, labels, onDelete }: RowActionsMenuProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      toast({ title: labels.deleted });
      setConfirmingDelete(false);
    } catch {
      // The mutation restores the row; the dialog stays open so the delete can be retried.
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    // The row navigates on click, and React bubbles the dialog's clicks through its portal.
    <div
      className="flex justify-end opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 has-[[data-state=open]]:opacity-100"
      onClick={(e) => e.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={labels.trigger}
            className={cn("data-[state=open]:bg-accent size-8", overviewTableText.muted)}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild>
            <IntentLink href={editHref}>
              <Pencil className="mr-2 size-4" />
              {labels.edit}
            </IntentLink>
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => {
              e.preventDefault();
              setConfirmingDelete(true);
            }}
          >
            <Trash2 className="mr-2 size-4" />
            {labels.delete}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{labels.delete}</AlertDialogTitle>
            <AlertDialogDescription>{labels.deleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{labels.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => {
                // Keeps the dialog open until the delete succeeds.
                e.preventDefault();
                void confirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="size-4 animate-spin" /> : labels.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

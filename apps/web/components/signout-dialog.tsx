"use client";

import { useRouter } from "next/navigation";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components";

interface SignOutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  translations: {
    title: string;
    description: string;
    cancel: string;
    confirm: string;
  };
}

export function SignOutDialog({ open, onOpenChange, translations }: SignOutDialogProps) {
  const router = useRouter();

  const handleConfirm = () => {
    router.push("/api/auth/logout");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{translations.title}</DialogTitle>
          <DialogDescription>{translations.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button onClick={() => onOpenChange(false)} variant="ghost">
            {translations.cancel}
          </Button>
          <Button onClick={handleConfirm} variant="default">
            {translations.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

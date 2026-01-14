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

import { useSignOut } from "../hooks/auth/useSignOut/useSignOut";

interface SignOutDialogProps {
  translations: {
    title: string;
    description: string;
    cancel: string;
    confirm: string;
  };
}

export function SignOutDialog({ translations }: SignOutDialogProps) {
  const router = useRouter();
  const signOut = useSignOut();

  const handleCancel = () => {
    router.back();
  };

  const onConfirm = async () => {
    await signOut.mutateAsync();
    router.push("/");
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          handleCancel();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{translations.title}</DialogTitle>
          <DialogDescription>{translations.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button onClick={handleCancel} variant="ghost" disabled={signOut.isPending}>
            {translations.cancel}
          </Button>
          <Button onClick={onConfirm} variant="default" disabled={signOut.isPending}>
            {translations.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

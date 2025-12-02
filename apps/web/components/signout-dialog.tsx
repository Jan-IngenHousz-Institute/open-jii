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

import { handleLogout } from "../app/actions/auth";

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

  const handleCancel = () => {
    router.back();
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
          <Button onClick={handleCancel} variant="ghost">
            {translations.cancel}
          </Button>
          <form action={() => handleLogout()} className="inline-flex">
            <Button type="submit" variant="default">
              {translations.confirm}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

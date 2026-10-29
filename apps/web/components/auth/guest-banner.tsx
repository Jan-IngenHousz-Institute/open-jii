"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { authClient } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";

export function GuestBanner({ name, locale }: { name: string; locale: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  async function leave() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(false);
    try {
      if (!navigator.onLine) throw new Error("offline");
      const result = await authClient.signOut();
      if (result.error) throw new Error("sign-out failed");
      await queryClient.cancelQueries();
      queryClient.clear();
      window.location.assign(`/${locale}/login`);
    } catch {
      setError(true);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  let action = "leave";
  if (error) action = "retry";
  return (
    <aside
      className="bg-muted flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3"
      aria-label={t("demo.bannerLabel")}
    >
      <p className="text-sm">{t("demo.banner", { name })}</p>
      <Button
        variant="outline"
        onClick={() => {
          setError(false);
          setOpen(true);
        }}
      >
        {t("demo.leave")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("demo.leaveTitle")}</DialogTitle>
            <DialogDescription>{t("demo.leaveDescription")}</DialogDescription>
          </DialogHeader>
          {error && <p role="alert">{t("demo.leaveError")}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              {t("demo.cancel")}
            </Button>
            <Button disabled={pending} onClick={() => void leave()}>
              {t("demo.leaveAction", { context: action })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

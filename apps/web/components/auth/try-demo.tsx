"use client";

import { orpc, orpcClient } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { zGuestName } from "@repo/api/shared/guest";
import { authClient } from "@repo/auth/client";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";

import { demoLandingOrganization } from "./demo-landing";

export function TryDemo({ locale }: { locale: string }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const availability = useQuery(
    orpc.users.getDemoAvailability.queryOptions({ staleTime: 0, retry: false }),
  );
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const entered = useRef(false);
  const busy = useRef(false);
  const entry = useMutation({
    mutationFn: async () => {
      if (busy.current) return;
      const parsed = zGuestName.safeParse(name);
      if (!parsed.success || name.includes("@")) {
        setError(t("demo.invalidName"));
        return;
      }
      busy.current = true;
      setError("");
      try {
        if (!entered.current) {
          const sessionClient = authClient;
          const existing = await sessionClient.getSession();
          if (existing.error || (existing.data && !existing.data.user.isAnonymous)) {
            setError(t("demo.entryError"));
            return;
          }
          let guestId = existing.data?.user.id;
          if (!guestId) {
            const result = await sessionClient.$fetch<{ user: { id: string } }>(
              "/sign-in/anonymous",
              { method: "POST", body: { name: parsed.data } },
            );
            if (result.error) {
              let context = "failed";
              if (result.error.status === 429) context = "limited";
              if ("code" in result.error && result.error.code === "DEMO_DISABLED")
                context = "disabled";
              setError(t("demo.entryError", { context }));
              return;
            }
            guestId = result.data.user.id;
          }
          if (!guestId) {
            setError(t("demo.entryError"));
            return;
          }
          entered.current = true;
          await client.cancelQueries();
          client.clear();
        }
        const directory = await orpcClient.organizations.listOrganizations({ scope: "related" });
        const demo = demoLandingOrganization(directory.organizations);
        if (!demo) {
          setError(t("demo.noContent"));
          return;
        }
        window.location.assign(`/${locale}/platform/organizations/${demo.id}`);
      } catch {
        setError(t("demo.entryError"));
      } finally {
        busy.current = false;
      }
    },
  });
  if (!availability.data?.enabled && !open) return null;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy.current) setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="mb-6 w-full">
          {t("demo.try")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("demo.title")}</DialogTitle>
          <DialogDescription>{t("demo.permanent")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            entry.mutate();
          }}
          className="space-y-4"
        >
          <Label htmlFor="guest-name">{t("demo.name")}</Label>
          <Input
            id="guest-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-describedby="guest-name-hint"
            disabled={entered.current || entry.isPending}
          />
          <p id="guest-name-hint" className="text-muted-foreground text-sm">
            {t("demo.nameHint")}
          </p>
          <a
            className="underline"
            href={`/${locale}/terms-and-conditions`}
            target="_blank"
            rel="noreferrer"
          >
            {t("demo.terms")}
          </a>
          {error && <p role="alert">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={entry.isPending}
              onClick={() => setOpen(false)}
            >
              {t("demo.cancel")}
            </Button>
            <Button type="submit" disabled={entry.isPending}>
              {t("demo.continue")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

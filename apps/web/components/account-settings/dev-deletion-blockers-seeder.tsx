"use client";

import { FlaskConical } from "lucide-react";
import { useClearDeletionBlockers } from "~/hooks/dev/useClearDeletionBlockers/useClearDeletionBlockers";
import { useSeedDeletionBlockers } from "~/hooks/dev/useSeedDeletionBlockers/useSeedDeletionBlockers";
import { parseApiError } from "~/util/apiError";

import { Button } from "@repo/ui/components/button";
import { toast } from "@repo/ui/hooks/use-toast";

/**
 * Dev-only tooling: one button seeds experiments covering every account-deletion case (sole-admin
 * active/archived, with/without members, plus a co-admin control), another removes them. Render
 * this only in development — gate at the call site so its hooks always run unconditionally.
 * Experiments are named with the user id, so seeding works across freshly created test users.
 */
export function DevDeletionBlockersSeeder() {
  const { mutateAsync: seed, isPending: isSeeding } = useSeedDeletionBlockers();
  const { mutateAsync: clear, isPending: isClearing } = useClearDeletionBlockers();
  const busy = isSeeding || isClearing;

  const handleSeed = async () => {
    try {
      const response = await seed({ body: {} });
      toast({ description: `Seeded ${response.body.created} test experiment(s).` });
    } catch (err) {
      toast({
        description: parseApiError(err)?.message ?? "Failed to seed test experiments",
        variant: "destructive",
      });
    }
  };

  const handleClear = async () => {
    try {
      const response = await clear({ body: {} });
      toast({ description: `Removed ${response.body.deleted} test experiment(s).` });
    } catch (err) {
      toast({
        description: parseApiError(err)?.message ?? "Failed to clear test experiments",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="border-muted-foreground/40 flex flex-col gap-3 rounded-md border border-dashed p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4">
      <div className="min-w-0">
        <h3 className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium">
          <FlaskConical className="h-4 w-4 shrink-0" />
          Dev tools — deletion blockers
        </h3>
        <p className="text-muted-foreground mt-1 text-xs">
          Local only. Seeds experiments (named with your user id) covering every delete-account
          case, using existing mock members.
        </p>
      </div>
      <div className="grid w-full gap-2 sm:flex sm:w-auto sm:shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          onClick={handleSeed}
          disabled={busy}
        >
          {isSeeding ? "Seeding…" : "Seed test experiments"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          onClick={handleClear}
          disabled={busy}
        >
          {isClearing ? "Clearing…" : "Clear test experiments"}
        </Button>
      </div>
    </div>
  );
}

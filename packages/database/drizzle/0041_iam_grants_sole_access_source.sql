-- ============================================================================
-- Data migration: make `resource_grants` the sole source of access to an
-- experiment.
--
-- Until now two things could confer experiment access: a row in
-- `experiment_members` (mirrored into `resource_grants` by 0039 and by the runtime
-- member paths) and a grant. From here only grants are read and
-- `experiment_members` goes dormant — so any member whose mirror grant is missing
-- has to get one now, or they would silently lose access the moment the roster
-- stops being consulted.
--
-- No DDL: `resource_grants` already has the shape this model needs (one row per
-- resource + grantee, carrying a role). This migration only moves data.
--
-- Folded into the migration rather than a hand-run script so it applies
-- automatically and atomically on db:migrate in every environment. Both
-- statements are set-based and safe to re-apply *immediately* — a half-applied
-- migration can be run again and lands in the same place (ON CONFLICT DO NOTHING
-- on the insert, a predicate the delete narrows to nothing once it has run).
--
-- That is not the same as being a no-op forever. Step 1 inserts where a grant is
-- absent, so if it were re-run long after the app went live it would restore a
-- grant that had since been revoked, for anyone still sitting in the dormant
-- roster. Nothing here prevents that: what does is drizzle's journal, which
-- applies each migration exactly once per database. Re-application requires
-- editing that journal by hand, and whoever does that owns the consequence.
--
-- `experiment_members` is only ever READ here. The table and its rows are left
-- physically untouched, with their data frozen.
-- ============================================================================
-- 1. Give every experiment member the grant that matches their roster role
--    (admin -> admin, member -> member — the same mapping 0039's mirror used, and
--    already the right answer: an `admin` grant administers, a `member` grant
--    reads and contributes, which is exactly what the two roster roles meant).
--
--    Most members already have this row, which is why no conversion is needed.
--    The gap this closes is invitation acceptance: it inserted a roster row
--    *without* mirroring a grant, so everyone who joined an experiment by
--    accepting an invitation holds membership and no grant at all.
--
--    ON CONFLICT DO NOTHING, so an existing grant is never overwritten — where a
--    grantee's role was set deliberately, the roster does not get to undo it.
--    `created_by` is left NULL: nobody authored these grants, which matches the
--    mirror rows already sitting beside them.
--
--    Members whose profile is soft-deleted are skipped: a closed account must not
--    be handed access it no longer holds anywhere else.
INSERT INTO "resource_grants" ("resource_type", "resource_id", "grantee_type", "grantee_id", "role")
SELECT 'experiment', em."experiment_id", 'user', em."user_id", em."role"::text
FROM "experiment_members" em
WHERE NOT EXISTS (
  SELECT 1 FROM "profiles" p
  WHERE p."user_id" = em."user_id"
    AND p."deleted_at" IS NOT NULL
)
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- 2. Delete the creator self-grants 0039 wrote on macro/protocol/workbook. Those
--    rows have grantee_id = created_by and role 'admin' (the creator granting
--    themselves). They are redundant with the personal-org owner role and would
--    otherwise surface as a phantom "collaborator" in the sharing UI — old
--    resources would show a collaborator that newly created ones never get. Safe
--    because the only grants that exist on these three types are exactly these
--    creator self-grants: no sharing write-path existed when they were written.
--    Devices are left untouched — device sharing has no surface yet, so nothing
--    lists their grants.
DELETE FROM "resource_grants"
WHERE "resource_type" IN ('macro', 'protocol', 'workbook')
  AND "grantee_type" = 'user'
  AND "role" = 'admin'
  AND "grantee_id" = "created_by";

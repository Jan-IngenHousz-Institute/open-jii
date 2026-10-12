-- ============================================================================
-- Data migration: make `resource_grants` the sole source of *explicit* access to
-- a shared resource.
--
-- Until now two things could confer experiment access: a row in
-- `experiment_members` (mirrored into `resource_grants` by 0039 and by the runtime
-- member paths) and a grant. From here only grants are read and
-- `experiment_members` goes dormant — so any member whose mirror grant is missing
-- has to get one now, or they would silently lose access the moment the roster
-- stops being consulted.
--
-- Answerability for a resource comes from **owning it**, not from holding a grant
-- on it: the owning organization's owners are the people responsible for it, and
-- they are resolved from `organization_id` at read time. A creator therefore gets
-- no grant of their own — see statement 2.
--
-- Grant readers in this release accept both `member` and `viewer` as the same
-- read-and-contribute tier. Existing rows are deliberately not renamed here: older
-- application instances can still write `member` grants while a rolling deployment
-- is in progress, and they require pending invitations to keep the `member` spelling.
-- The data rename and invitation default change are deferred to a follow-up release,
-- once no pre-rename application instance can still be live.
--
-- New grant writes use `viewer`, which the previous application version already
-- understands on reads. `resource_grants` otherwise already has the shape this model
-- needs (one row per resource + grantee, carrying a role).
--
-- Folded into the migration rather than a hand-run script so it applies
-- automatically and atomically on db:migrate in every environment. Statement 1 is
-- a set-based INSERT with ON CONFLICT DO NOTHING and statement 2 is a set-based
-- DELETE, so a half-applied migration can be run again and lands in exactly the same
-- place.
--
-- That is not the same as being a no-op forever. Statement 1 inserts where a grant
-- is absent, so if it were re-run long after the app went live it would restore a
-- roster member's access that had since been revoked. Nothing here prevents that:
-- what does is drizzle's journal, which applies each migration exactly once per
-- database. Re-application requires editing that journal by hand, and whoever does
-- that owns the consequence.
--
-- `experiment_members` is only ever READ here. The table and its rows are left
-- physically untouched, with their data frozen — its own `member` roster role is a
-- separate vocabulary and is deliberately not renamed.
-- ============================================================================
ALTER TABLE "resource_grants" ALTER COLUMN "role" SET DEFAULT 'viewer';--> statement-breakpoint
-- 1. Give every experiment member the grant that matches their roster role
--    (admin -> admin, member -> viewer — the same two tiers 0039's mirror produced,
--    written under the grant vocabulary's own names: an `admin` grant administers, a
--    `viewer` grant reads and contributes, which is exactly what the two roster roles
--    meant. The roster keeps its own spelling; it is a separate vocabulary).
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
SELECT 'experiment', em."experiment_id", 'user', em."user_id", CASE WHEN em."role" = 'admin' THEN 'admin' ELSE 'viewer' END
FROM "experiment_members" em
WHERE NOT EXISTS (
  SELECT 1 FROM "profiles" p
  WHERE p."user_id" = em."user_id"
    AND p."deleted_at" IS NOT NULL
)
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- 2. Delete the creators' own grants on every shareable type, so no creator is
--    a collaborator on their own resource. Access and answerability both follow
--    from the owning organization: its owners hold every action through the org
--    role, and the collaborators surface renders them as a synthesized "Owner"
--    row. A creator grant on top of that conferred nothing and rendered twice —
--    once as the owner, once as an ordinary "Can edit" collaborator.
--
--    Covers all five shareable types so they behave identically. On experiments
--    this also removes the creator's admin grant that statement 1 just re-created
--    from the dormant roster (the creator was a roster admin), which is why the
--    order matters: insert the roster first, then strip the creator back out.
--
--    The `organization_members` guard is what makes this provably access-neutral,
--    and it is not a formality: `organization_id` is nullable, and rows predating
--    the 0039/0040 org backfill still carry NULL. On those the creator's grant is
--    their *only* access — there is no owning org to inherit it from and no owner
--    row to render — so the guard leaves it in place. Same for a creator who
--    holds only `member` in a shared owning org: `member` is read-only, so their
--    grant is doing real work and is kept. Only a creator who already has full
--    control through the org (`owner`/`admin`, the two roles the access matrix
--    gives every action) loses the redundant row.
--
--    No role filter on the grant itself: whatever tier it carries, it is
--    redundant once the org role covers everything, and leaving a creator behind
--    as a "Can view" collaborator on their own resource is exactly the phantom
--    row this removes.
--
--    Devices are in. They now carry the same collaborators surface as the other
--    four — 0039 backfilled creator admin grants on them — so a device creator
--    left behind here would render beside the Owner row exactly like the phantom
--    rows this statement removes everywhere else.
DELETE FROM "resource_grants" g
USING (
  SELECT 'experiment'::"resource_type" AS "resource_type", e."id", e."created_by", e."organization_id" FROM "experiments" e
  UNION ALL
  SELECT 'macro'::"resource_type", m."id", m."created_by", m."organization_id" FROM "macros" m
  UNION ALL
  SELECT 'protocol'::"resource_type", p."id", p."created_by", p."organization_id" FROM "protocols" p
  UNION ALL
  SELECT 'workbook'::"resource_type", w."id", w."created_by", w."organization_id" FROM "workbooks" w
  UNION ALL
  SELECT 'device'::"resource_type", d."id", d."created_by", d."organization_id" FROM "iot_devices" d
) r
WHERE g."resource_type" = r."resource_type"
  AND g."resource_id" = r."id"
  AND g."grantee_type" = 'user'
  AND g."grantee_id" = r."created_by"
  AND EXISTS (
    SELECT 1 FROM "organization_members" om
    WHERE om."organization_id" = r."organization_id"
      AND om."user_id" = r."created_by"
      AND om."role" IN ('owner', 'admin')
  );

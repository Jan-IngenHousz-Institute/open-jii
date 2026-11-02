-- Custom SQL migration file, put your code below! --
-- An organization's grant on a resource it owns gives every member its role, so an admin grant
-- hands plain members full control. Sharing with the owning organization is now refused and a
-- transfer drops the destination's grant; this removes the ones made before either check.
DELETE FROM "resource_grants" g
USING (
  SELECT 'experiment'::"resource_type" AS "resource_type", e."id", e."organization_id" FROM "experiments" e
  UNION ALL
  SELECT 'macro'::"resource_type", m."id", m."organization_id" FROM "macros" m
  UNION ALL
  SELECT 'protocol'::"resource_type", p."id", p."organization_id" FROM "protocols" p
  UNION ALL
  SELECT 'workbook'::"resource_type", w."id", w."organization_id" FROM "workbooks" w
  UNION ALL
  SELECT 'device'::"resource_type", d."id", d."organization_id" FROM "iot_devices" d
  UNION ALL
  SELECT 'device_group'::"resource_type", dg."id", dg."organization_id" FROM "device_groups" dg
  UNION ALL
  SELECT 'calibration_definition'::"resource_type", c."id", c."organization_id" FROM "calibration_definitions" c
) r
WHERE g."resource_type" = r."resource_type"
  AND g."resource_id" = r."id"
  AND g."grantee_type" = 'organization'
  AND g."grantee_id" = r."organization_id";

ALTER TABLE "protocols" RENAME TO "commands";--> statement-breakpoint
ALTER TABLE "protocol_macros" RENAME TO "command_macros";--> statement-breakpoint
ALTER TABLE "command_macros" RENAME COLUMN "protocol_id" TO "command_id";--> statement-breakpoint
ALTER TABLE "commands" RENAME CONSTRAINT "protocols_name_unique" TO "commands_name_unique";--> statement-breakpoint
ALTER TABLE "commands" RENAME CONSTRAINT "protocols_created_by_users_id_fk" TO "commands_created_by_users_id_fk";--> statement-breakpoint
ALTER TABLE "commands" RENAME CONSTRAINT "protocols_forked_from_protocols_id_fk" TO "commands_forked_from_commands_id_fk";--> statement-breakpoint
ALTER TABLE "command_macros" RENAME CONSTRAINT "protocol_macros_protocol_id_macro_id_pk" TO "command_macros_command_id_macro_id_pk";--> statement-breakpoint
ALTER TABLE "command_macros" RENAME CONSTRAINT "protocol_macros_protocol_id_protocols_id_fk" TO "command_macros_command_id_commands_id_fk";--> statement-breakpoint
ALTER TABLE "command_macros" RENAME CONSTRAINT "protocol_macros_macro_id_macros_id_fk" TO "command_macros_macro_id_macros_id_fk";--> statement-breakpoint
ALTER TABLE "workbook_versions" ALTER COLUMN "entity_snapshots" SET DEFAULT '{"commands":{},"macros":{}}'::jsonb;--> statement-breakpoint
UPDATE "workbooks" SET "cells" = (
  SELECT jsonb_agg(
    CASE WHEN elem->>'type' = 'protocol'
      THEN jsonb_set(
        jsonb_set(elem, '{type}', '"command"'),
        '{payload}',
        ((elem->'payload') - 'protocolId'::text) || jsonb_build_object('commandId', elem->'payload'->'protocolId')
      )
      ELSE elem
    END ORDER BY ord)
  FROM jsonb_array_elements("cells") WITH ORDINALITY AS t(elem, ord)
) WHERE EXISTS (SELECT 1 FROM jsonb_array_elements("cells") e WHERE e->>'type' = 'protocol');--> statement-breakpoint
UPDATE "workbook_versions" SET "cells" = (
  SELECT jsonb_agg(
    CASE WHEN elem->>'type' = 'protocol'
      THEN jsonb_set(
        jsonb_set(elem, '{type}', '"command"'),
        '{payload}',
        ((elem->'payload') - 'protocolId'::text) || jsonb_build_object('commandId', elem->'payload'->'protocolId')
      )
      ELSE elem
    END ORDER BY ord)
  FROM jsonb_array_elements("cells") WITH ORDINALITY AS t(elem, ord)
) WHERE EXISTS (SELECT 1 FROM jsonb_array_elements("cells") e WHERE e->>'type' = 'protocol');--> statement-breakpoint
UPDATE "workbook_versions" SET "entity_snapshots" = ("entity_snapshots" - 'protocols'::text) || jsonb_build_object('commands', COALESCE("entity_snapshots"->'protocols', '{}'::jsonb))
  WHERE "entity_snapshots" ? 'protocols';--> statement-breakpoint
UPDATE "flows" SET "graph" = jsonb_set("graph", '{nodes}', (
  SELECT jsonb_agg(
    CASE WHEN node->'content' ? 'protocolId'
      THEN jsonb_set(node, '{content}', ((node->'content') - 'protocolId'::text) || jsonb_build_object('commandId', node->'content'->'protocolId'))
      ELSE node
    END ORDER BY ord)
  FROM jsonb_array_elements("graph"->'nodes') WITH ORDINALITY AS t(node, ord)
)) WHERE EXISTS (SELECT 1 FROM jsonb_array_elements("graph"->'nodes') n WHERE n->'content' ? 'protocolId');

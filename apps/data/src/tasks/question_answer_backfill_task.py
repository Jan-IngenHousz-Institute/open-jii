# Databricks notebook source
import json

from enrich.backend_client import BackendClient
from openjii.question_answer_backfill import audit_backfill, rollback_backfill, run_backfill, validate_manifest

for name, default in [("MANIFEST_JSON", "{}"), ("MODE", "dry-run"), ("ENVIRONMENT", ""),
                      ("REVIEWED_FINGERPRINT", ""), ("PIPELINES_PAUSED", "false"),
                      ("MACRO_STREAM_DRAINED", "false")]:
    dbutils.widgets.text(name, default)

environment = dbutils.widgets.get("ENVIRONMENT")
if environment not in {"dev", "prod"}:
    raise ValueError("Choose the explicit dev or prod registry environment")
manifest = json.loads(dbutils.widgets.get("MANIFEST_JSON"))
validate_manifest(manifest)
if any(target[field].split(".")[0] != f"open_jii_{environment}"
       for target in manifest["tables"].values() for field in ["name", "backup"]):
    raise ValueError("Source and backup catalogs must match the chosen registry environment")
scope = f"node-webhook-secret-scope-{environment}"
client = BackendClient(
    dbutils.secrets.get(scope=scope, key="webhook_base_url"),
    dbutils.secrets.get(scope=scope, key="webhook_api_key_id"),
    dbutils.secrets.get(scope=scope, key="webhook_secret"),
)
mode = dbutils.widgets.get("MODE")
options = dict(registry_lookup=client.get_numeric_question_keys)
if mode == "audit":
    report = audit_backfill(spark, manifest, **options)
elif mode in {"rollback", "rollback-after-resume"}:
    report = rollback_backfill(spark, manifest, **options,
        reviewed_fingerprint=dbutils.widgets.get("REVIEWED_FINGERPRINT"),
        pipelines_paused=dbutils.widgets.get("PIPELINES_PAUSED") == "true",
        after_resume=mode == "rollback-after-resume")
elif mode in {"dry-run", "apply"}:
    report = run_backfill(spark, manifest, **options, apply=mode == "apply",
        reviewed_fingerprint=dbutils.widgets.get("REVIEWED_FINGERPRINT"),
        pipelines_paused=dbutils.widgets.get("PIPELINES_PAUSED") == "true",
        macro_stream_drained=dbutils.widgets.get("MACRO_STREAM_DRAINED") == "true")
else:
    raise ValueError("MODE must be dry-run, apply, audit, rollback or rollback-after-resume")
dbutils.notebook.exit(json.dumps(report, sort_keys=True))

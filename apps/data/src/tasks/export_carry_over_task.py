# Databricks notebook source
# DBTITLE 1,Export Carry-Over
# One-off. Copies the exports finished in the last DAYS days from the old data-exports volume
# into the exports volume, in parts with a manifest, and records them in the backend's export
# list. It reads what each export was from the export job's run history, so exports whose
# metadata row was never written are carried over too. Running it again copies nothing twice.
#
# Run once per environment, after the release that adds export records:
#
#   sed -e "s/{ENV}/prod/g" -e "s/{EXPORT_JOB_ID}/<job id>/g" \
#     apps/data/src/tasks/export_carry_over.submit.json \
#     | databricks jobs submit --json @- -p <profile>
#
# Delete this notebook, its submit spec and the old volume once the run is verified.

# COMMAND ----------

# DBTITLE 1,Imports
import ast
import io
import json
import math
from datetime import datetime, timedelta, timezone

from databricks.sdk import WorkspaceClient
from enrich.backend_client import BackendClient
from pyspark.dbutils import DBUtils
from pyspark.sql import SparkSession


def log(msg: str, level: str = "INFO"):
    print(f"[{level}] {msg}", flush=True)

# COMMAND ----------

# DBTITLE 1,Configuration
EXPORT_JOB_ID = int(dbutils.widgets.get("EXPORT_JOB_ID"))
CATALOG_NAME = dbutils.widgets.get("CATALOG_NAME")
ENVIRONMENT = dbutils.widgets.get("ENVIRONMENT")
DAYS = int(dbutils.widgets.get("DAYS") or "30")

spark = SparkSession.builder.getOrCreate()
dbutils = DBUtils(spark)
workspace = WorkspaceClient()

OLD_ROOT = f"/Volumes/{CATALOG_NAME}/centrum/data-exports"
NEW_ROOT = f"/Volumes/{CATALOG_NAME}/centrum/exports"

# COMMAND ----------

# DBTITLE 1,Records
# Kept equal to the export task's, so a carried-over export is cut like a new one.
ROWS_PER_PART = 1_000_000
MANIFEST_NAME = "manifest.json"
BATCH_SIZE = 50


def parse_legacy_output(result):
    """The old task's exit value, a Python dict repr, when it describes a written export."""
    if not result:
        return None
    try:
        value = ast.literal_eval(result)
    except (ValueError, SyntaxError):
        return None
    if not isinstance(value, dict) or value.get("status") != "success" or not value.get("export_id"):
        return None
    return value


def iso_utc(epoch_ms: int) -> str:
    moment = datetime.fromtimestamp(epoch_ms / 1000, timezone.utc)
    return moment.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def part_count(row_count: int) -> int:
    return max(1, math.ceil(row_count / ROWS_PER_PART))


def is_part_file(name: str) -> bool:
    return not name.startswith(("_", ".")) and name != MANIFEST_NAME


def carried_record(params: dict, output: dict, run_id: int, start_ms: int, end_ms: int, parts: list) -> dict:
    return {
        "exportId": output["export_id"],
        "experimentId": params["EXPERIMENT_ID"],
        "tableName": params["TABLE_NAME"],
        "format": params["FORMAT"],
        "anonymizeContributors": (params.get("ANONYMIZE_CONTRIBUTORS") or "").lower() == "true",
        "jobRunId": run_id,
        "rowCount": int(output["row_count"]),
        "parts": parts,
        "createdBy": params["USER_ID"],
        "createdAt": iso_utc(start_ms),
        "completedAt": iso_utc(end_ms),
    }


def batches(items: list, size: int):
    for start in range(0, len(items), size):
        yield items[start : start + size]

# COMMAND ----------

# DBTITLE 1,Copy
def finished_runs(since_ms: int):
    for run in workspace.jobs.list_runs(
        job_id=EXPORT_JOB_ID, completed_only=True, start_time_from=since_ms, expand_tasks=True
    ):
        if run.state and run.state.result_state and run.state.result_state.value == "SUCCESS":
            yield run


def legacy_output(run):
    """The exit value of the run's last task attempt, which is the one that succeeded."""
    attempts = sorted(run.tasks or [], key=lambda task: task.attempt_number or 0)
    if not attempts:
        return None
    output = workspace.jobs.get_run_output(run_id=attempts[-1].run_id)
    return parse_legacy_output(output.notebook_output.result if output.notebook_output else None)


def list_parts(directory: str) -> list:
    files = sorted((f for f in dbutils.fs.ls(directory) if is_part_file(f.name)), key=lambda f: f.name)
    return [{"name": f.name, "sizeBytes": f.size} for f in files]


def exists(path: str) -> bool:
    try:
        dbutils.fs.ls(path)
        return True
    except Exception:
        return False


def copy_export(old_dir: str, new_dir: str, export_format: str, row_count: int) -> list:
    """Copies one export and writes its manifest; returns its parts."""
    if export_format == "parquet":
        # Rewritten rather than copied, so a large file arrives cut into parts like a new export.
        spark.read.parquet(old_dir).coalesce(part_count(row_count)).write.mode("overwrite").parquet(new_dir)
    else:
        for name in (f.name for f in dbutils.fs.ls(old_dir) if is_part_file(f.name)):
            dbutils.fs.cp(f"{old_dir}/{name}", f"{new_dir}/{name}")

    return list_parts(new_dir)


def write_manifest(new_dir: str, manifest: dict) -> None:
    workspace.files.create_directory(new_dir)
    workspace.files.upload(
        f"{new_dir}/{MANIFEST_NAME}", io.BytesIO(json.dumps(manifest).encode("utf-8")), overwrite=True
    )


def read_manifest(new_dir: str) -> dict:
    return json.loads(workspace.files.download(f"{new_dir}/{MANIFEST_NAME}").contents.read())


def carry_over(run, params: dict, output: dict) -> dict | None:
    folder = f"{params['EXPERIMENT_ID']}/{params['TABLE_NAME']}/{params['FORMAT']}/{output['export_id']}"
    old_dir = f"{OLD_ROOT}/{folder}"
    new_dir = f"{NEW_ROOT}/{folder}"

    if exists(f"{new_dir}/{MANIFEST_NAME}"):
        parts = read_manifest(new_dir)["parts"]
    elif exists(f"{old_dir}/_SUCCESS"):
        row_count = int(output["row_count"])
        parts = copy_export(old_dir, new_dir, params["FORMAT"], row_count)
        write_manifest(
            new_dir,
            {
                "exportId": output["export_id"],
                "format": params["FORMAT"],
                "rowCount": row_count,
                "snapshotAt": iso_utc(run.start_time),
                "parts": parts,
            },
        )
    else:
        log(f"Skipping {folder}: the old folder has no finished export", "WARN")
        return None

    if not parts:
        log(f"Skipping {folder}: no files were copied", "WARN")
        return None

    return carried_record(params, output, run.run_id, run.start_time, run.end_time, parts)

# COMMAND ----------

# DBTITLE 1,Main
def main():
    since = datetime.now(timezone.utc) - timedelta(days=DAYS)
    records = []
    skipped = 0

    for run in finished_runs(int(since.timestamp() * 1000)):
        params = {p.name: p.value for p in (run.job_parameters or [])}
        output = legacy_output(run)
        if output is None or not params.get("USER_ID") or int(output.get("row_count") or 0) < 1:
            skipped += 1
            continue

        try:
            record = carry_over(run, params, output)
        except Exception as error:
            log(f"Could not carry over run {run.run_id}: {error}", "ERROR")
            record = None

        if record is None:
            skipped += 1
        else:
            records.append(record)
            log(f"Carried over export {record['exportId']} ({len(record['parts'])} part(s))")

    scope = f"node-webhook-secret-scope-{ENVIRONMENT}"
    client = BackendClient(
        base_url=dbutils.secrets.get(scope=scope, key="webhook_base_url"),
        api_key_id=dbutils.secrets.get(scope=scope, key="webhook_api_key_id"),
        webhook_secret=dbutils.secrets.get(scope=scope, key="webhook_secret"),
    )
    recorded = sum(client.carry_over_exports(batch)["imported"] for batch in batches(records, BATCH_SIZE))

    summary = {"carriedOver": len(records), "recorded": recorded, "skipped": skipped}
    log(f"Done: {summary}")
    dbutils.notebook.exit(json.dumps(summary))


main()
